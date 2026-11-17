
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext } from '@/lib/reda-scope'
import { requirePlatformOwner } from '@/lib/tenant-context'

const PROOF_BUCKET = 'dokkan-subscription-proofs'
const MAX_PROOF_SIZE = 5 * 1024 * 1024

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

type ProofMimeType = (typeof ALLOWED_MIME_TYPES)[number]
type PaidPlanCode = 'basic' | 'professional' | 'enterprise'

function isPaidPlanCode(value: string): value is PaidPlanCode {
  return ['basic', 'professional', 'enterprise'].includes(value)
}

function isProofMimeType(value: string): value is ProofMimeType {
  return ALLOWED_MIME_TYPES.includes(value as ProofMimeType)
}

function getSafeError(error: unknown, fallback: string) {
  const message =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : error instanceof Error
        ? error.message
        : ''

  if (message.includes('not authorized')) {
    return 'ليس لديك صلاحية تنفيذ هذه العملية.'
  }

  if (message.includes('not pending')) {
    return 'هذا الطلب تمت مراجعته بالفعل.'
  }

  if (message.includes('proof file')) {
    return 'تعذر التحقق من ملف إثبات الدفع.'
  }

  if (message.includes('already exists')) {
    return 'يوجد طلب اشتراك مفتوح بالفعل لهذا المتجر.'
  }

  if (message.includes('active store')) {
    return 'يجب أن يكون المتجر نشطًا حتى تتمكن من تقديم طلب اشتراك.'
  }

  if (message.includes('cannot be submitted')) {
    return 'هذا الطلب لم يعد قابلًا للإرسال.'
  }

  if (message.includes('cannot be cancelled')) {
    return 'لا يمكن إلغاء هذا الطلب.'
  }

  return fallback
}

function revalidateSubscriptionPages() {
  revalidatePath('/subscription')
  revalidatePath('/platform')
  revalidatePath('/platform/subscription-requests')
}

/**
 * إنشاء طلب اشتراك مبدئي.
 */
export async function createSubscriptionRequestDraftAction(input: {
  planCode: string
  proofMimeType: string
  claimedAmountEgp?: number | null
}) {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  if (!isPaidPlanCode(input.planCode)) {
    throw new Error('الخطة المطلوبة غير صحيحة.')
  }

  if (!isProofMimeType(input.proofMimeType)) {
    throw new Error('نوع ملف إثبات الدفع غير مدعوم.')
  }

  const claimedAmount =
    input.claimedAmountEgp == null
      ? null
      : Number(input.claimedAmountEgp)

  if (
    claimedAmount !== null &&
    (!Number.isFinite(claimedAmount) || claimedAmount < 0)
  ) {
    throw new Error('راجع المبلغ الذي أدخلته.')
  }

  const { data, error } = await context.supabase.rpc(
    'dokkan_create_subscription_request',
    {
      p_plan_code: input.planCode,
      p_proof_mime_type: input.proofMimeType,
      p_claimed_amount_egp: claimedAmount,
    }
  )

  if (error) {
    console.error('[subscription-draft]', {
      code: error.code,
    })

    throw new Error(
      getSafeError(error, 'تعذر إنشاء طلب الاشتراك.')
    )
  }

  const result = Array.isArray(data) ? data[0] : data

  if (
    !result ||
    typeof result.request_id !== 'string' ||
    typeof result.proof_path !== 'string'
  ) {
    throw new Error('لم يتم استلام بيانات طلب الاشتراك.')
  }

  revalidatePath('/subscription')

  return {
    ok: true as const,
    requestId: result.request_id,
    proofPath: result.proof_path,
  }
}

/**
 * رفع إثبات الدفع وإرسال الطلب للمراجعة.
 * يمكن إعادة المحاولة بنفس رقم الطلب إذا تعطل الإرسال.
 */
export async function uploadSubscriptionProofAndSubmitAction(
  requestId: string,
  file: File
) {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  if (!requestId?.trim()) {
    throw new Error('رقم طلب الاشتراك غير صحيح.')
  }

  if (
    !file ||
    typeof file.size !== 'number' ||
    file.size < 1 ||
    file.size > MAX_PROOF_SIZE
  ) {
    throw new Error(
      'حجم الملف يجب أن يكون أكبر من صفر وألا يتجاوز 5 ميجابايت.'
    )
  }

  if (!isProofMimeType(file.type)) {
    throw new Error('نوع الملف غير مدعوم.')
  }

  const { data: request, error: requestError } =
    await context.supabase
      .from('dokkan_subscription_requests')
      .select(`
        id,
        store_id,
        status,
        proof_path,
        proof_mime_type
      `)
      .eq('id', requestId)
      .eq('store_id', context.storeId)
      .single()

  if (requestError || !request) {
    throw new Error(
      'طلب الاشتراك غير موجود أو لا تملك صلاحية الوصول إليه.'
    )
  }

  if (request.status !== 'draft') {
    throw new Error(
      'هذا الطلب لم يعد قابلًا للتعديل أو الإرسال.'
    )
  }

  if (request.proof_mime_type !== file.type) {
    throw new Error(
      'نوع الملف لا يطابق نوع الإثبات المحدد للطلب.'
    )
  }

  const folder = `${context.storeId}/${requestId}`
  const fileName = request.proof_path.split('/').pop()

  if (!fileName) {
    throw new Error('مسار ملف الإثبات غير صحيح.')
  }

  // التحقق مما إذا كان الملف قد رُفع في محاولة سابقة.
  const { data: existingFiles, error: listError } =
    await context.supabase.storage
      .from(PROOF_BUCKET)
      .list(folder, {
        search: fileName,
        limit: 10,
      })

  if (listError) {
    throw new Error(
      'تعذر التحقق من ملف الإثبات الحالي.'
    )
  }

  const alreadyUploaded = (existingFiles ?? []).some(
    (item) => item.name === fileName
  )

  // لا نستبدل الملف إذا كان قد رُفع بالفعل.
  if (!alreadyUploaded) {
    const { error: uploadError } =
      await context.supabase.storage
        .from(PROOF_BUCKET)
        .upload(request.proof_path, file, {
          contentType: file.type,
          upsert: false,
        })

    if (uploadError) {
      console.error('[subscription-proof-upload]', {
        code: uploadError.name,
      })

      throw new Error(
        'تعذر رفع إثبات الدفع. يمكنك إعادة المحاولة بنفس الطلب.'
      )
    }
  }

  const { error: submitError } =
    await context.supabase.rpc(
      'dokkan_submit_subscription_request',
      {
        p_request_id: requestId,
      }
    )

  if (submitError) {
    console.error('[subscription-submit]', {
      code: submitError.code,
    })

    throw new Error(
      getSafeError(
        submitError,
        'تم رفع الملف، لكن تعذر إرسال الطلب للمراجعة. يمكنك إعادة المحاولة.'
      )
    )
  }

  revalidateSubscriptionPages()

  return {
    ok: true as const,
    message: 'تم إرسال طلب الاشتراك للمراجعة بنجاح.',
  }
}

/**
 * إلغاء مسودة غير مرسلة وحذف ملف إثباتها.
 *
 * يسمح بإعادة محاولة الحذف إذا أُلغيت المسودة
 * سابقًا وفشل حذف الملف من Storage.
 */
export async function cancelSubscriptionRequestDraftAction(
  requestId: string
) {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  if (!requestId?.trim()) {
    throw new Error('رقم طلب الاشتراك غير صحيح.')
  }

  const { data: userData, error: userError } =
    await context.supabase.auth.getUser()

  if (userError || !userData.user) {
    throw new Error('تعذر التحقق من حساب المستخدم.')
  }

  const { data: request, error: requestError } =
    await context.supabase
      .from('dokkan_subscription_requests')
      .select(`
        id,
        store_id,
        status,
        proof_path,
        created_by
      `)
      .eq('id', requestId)
      .eq('store_id', context.storeId)
      .single()

  if (requestError || !request) {
    throw new Error('طلب الاشتراك غير موجود.')
  }

  if (request.created_by !== userData.user.id) {
    throw new Error(
      'فقط المستخدم الذي أنشأ المسودة يمكنه إلغاؤها.'
    )
  }

  if (
    request.status !== 'draft' &&
    request.status !== 'cancelled'
  ) {
    throw new Error(
      'لا يمكن إلغاء طلب تم إرساله للمراجعة.'
    )
  }

  // تغيير الحالة أولًا حتى تسمح سياسة Storage بالحذف.
  if (request.status === 'draft') {
    const { error: cancelError } =
      await context.supabase.rpc(
        'dokkan_cancel_subscription_request',
        {
          p_request_id: requestId,
        }
      )

    if (cancelError) {
      console.error('[subscription-cancel]', {
        code: cancelError.code,
      })

      throw new Error(
        getSafeError(
          cancelError,
          'تعذر إلغاء مسودة الاشتراك.'
        )
      )
    }
  }

  // حذف ملف المسودة الملغاة فقط.
  const { error: removeError } =
    await context.supabase.storage
      .from(PROOF_BUCKET)
      .remove([request.proof_path])

  if (removeError) {
    console.error('[subscription-proof-delete]', {
      name: removeError.name,
    })

    throw new Error(
      'تم إلغاء المسودة، لكن تعذر حذف ملف الإثبات. يمكنك إعادة المحاولة.'
    )
  }

  revalidateSubscriptionPages()

  return {
    ok: true as const,
    message: 'تم إلغاء المسودة وحذف ملف الإثبات.',
  }
}

/**
 * عرض طلبات اشتراك المتجر الحالي.
 * تتضمن المسودات حتى يمكن استكمالها بعد إعادة فتح الصفحة.
 */
export async function getMySubscriptionRequestsAction() {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  const { data, error } = await context.supabase
    .from('dokkan_subscription_requests')
    .select(`
      id,
      requested_plan_code,
      status,
      proof_mime_type,
      claimed_amount_egp,
      created_at,
      submitted_at,
      reviewed_at,
      rejection_reason,
      verified_amount_egp,
      subscription_started_at,
      subscription_ends_at
    `)
    .eq('store_id', context.storeId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error('تعذر تحميل طلبات الاشتراك.')
  }

  return data ?? []
}

/**
 * عرض طلبات الاشتراك لمدير المنصة.
 * روابط الإثبات مؤقتة لجميع الحالات المعروضة.
 */
export async function getPlatformSubscriptionRequestsAction(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending'
) {
  const { supabase } = await requirePlatformOwner()

  let query = supabase
    .from('dokkan_subscription_requests')
    .select(`
      id,
      store_id,
      requested_plan_code,
      status,
      proof_path,
      proof_mime_type,
      proof_size,
      claimed_amount_egp,
      verified_amount_egp,
      created_at,
      submitted_at,
      reviewed_at,
      rejection_reason,
      admin_notes,
      subscription_started_at,
      subscription_ends_at,
      dokkan_stores (
        name,
        phone
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[platform-subscription-requests]', {
      code: error.code,
    })

    throw new Error('تعذر تحميل طلبات الاشتراك.')
  }

  const requests = data ?? []

  return Promise.all(
    requests.map(async (request) => {
      let proofSignedUrl: string | null = null

      if (request.proof_path) {
        const { data: signed, error: signedError } =
          await supabase.storage
            .from(PROOF_BUCKET)
            .createSignedUrl(
              request.proof_path,
              5 * 60
            )

        if (!signedError) {
          proofSignedUrl = signed?.signedUrl ?? null
        } else {
          console.error('[subscription-proof-signed-url]', {
            code: signedError.name,
            requestId: request.id,
          })
        }
      }

      return {
        ...request,
        proofSignedUrl,
      }
    })
  )
}

/**
 * موافقة مدير المنصة على الطلب.
 */
export async function approveSubscriptionRequestAction(input: {
  requestId: string
  verifiedAmountEgp: number
  subscriptionEndsAt: string
  adminNotes?: string
}) {
  const { supabase } = await requirePlatformOwner()

  const amount = Number(input.verifiedAmountEgp)
  const endDate = new Date(input.subscriptionEndsAt)

  if (
    !input.requestId ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    Number.isNaN(endDate.getTime()) ||
    endDate.getTime() <= Date.now()
  ) {
    throw new Error(
      'راجع المبلغ وتاريخ انتهاء الاشتراك.'
    )
  }

  const { error } = await supabase.rpc(
    'dokkan_approve_subscription_request',
    {
      p_request_id: input.requestId,
      p_verified_amount_egp: amount,
      p_subscription_ends_at: endDate.toISOString(),
      p_admin_notes: input.adminNotes?.trim() || null,
    }
  )

  if (error) {
    console.error('[subscription-approve]', {
      code: error.code,
    })

    throw new Error(
      getSafeError(
        error,
        'تعذر اعتماد طلب الاشتراك.'
      )
    )
  }

  revalidateSubscriptionPages()

  return {
    ok: true as const,
    message: 'تم اعتماد الاشتراك وتفعيله.',
  }
}

/**
 * رفض طلب الاشتراك مع تسجيل السبب.
 */
export async function rejectSubscriptionRequestAction(input: {
  requestId: string
  rejectionReason: string
}) {
  const { supabase } = await requirePlatformOwner()

  const reason = input.rejectionReason?.trim()

  if (
    !input.requestId ||
    !reason ||
    reason.length > 1000
  ) {
    throw new Error(
      'اكتب سببًا واضحًا لرفض الطلب.'
    )
  }

  const { error } = await supabase.rpc(
    'dokkan_reject_subscription_request',
    {
      p_request_id: input.requestId,
      p_rejection_reason: reason,
    }
  )

  if (error) {
    console.error('[subscription-reject]', {
      code: error.code,
    })

    throw new Error(
      getSafeError(
        error,
        'تعذر رفض طلب الاشتراك.'
      )
    )
  }

  revalidateSubscriptionPages()

  return {
    ok: true as const,
    message: 'تم رفض طلب الاشتراك وتسجيل السبب.',
  }
}
