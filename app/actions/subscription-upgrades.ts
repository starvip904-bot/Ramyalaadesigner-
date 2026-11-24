
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext } from '@/lib/reda-scope'

const ALLOWED_PROOF_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

type ProofMimeType = (typeof ALLOWED_PROOF_TYPES)[number]
type UpgradePlanCode = 'basic' | 'professional'

function isProofMimeType(value: string): value is ProofMimeType {
  return ALLOWED_PROOF_TYPES.includes(value as ProofMimeType)
}

function isUpgradePlanCode(value: string): value is UpgradePlanCode {
  return value === 'basic' || value === 'professional'
}

function getUpgradeErrorMessage(error: unknown): string {
  const message =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message.toLowerCase()
      : ''

  if (message.includes('not authenticated')) {
    return 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.'
  }

  if (message.includes('active store membership')) {
    return 'لا توجد عضوية نشطة مؤهلة لتقديم طلب الترقية.'
  }

  if (message.includes('exactly one active store')) {
    return 'يجب أن يكون لديك متجر نشط واحد فقط لتقديم طلب الترقية.'
  }

  if (message.includes('current plan is not eligible')) {
    return 'خطتك الحالية غير مؤهلة للترقية من هذه الصفحة.'
  }

  if (message.includes('active subscription required')) {
    return 'لا يوجد اشتراك مدفوع نشط يمكن حساب الترقية عليه.'
  }

  if (message.includes('target plan must be higher')) {
    return 'يجب اختيار خطة أعلى من خطتك الحالية.'
  }

  if (message.includes('already exists')) {
    return 'لديك طلب اشتراك أو ترقية مفتوح بالفعل.'
  }

  if (message.includes('approved subscription history')) {
    return 'تعذر العثور على سجل دفع معتمد لاستخدامه في حساب الرصيد المتبقي.'
  }

  if (message.includes('unsupported current billing cycle')) {
    return 'دورة اشتراكك الحالية غير مدعومة لحساب الترقية.'
  }

  if (message.includes('target plan price unavailable')) {
    return 'سعر الخطة المطلوبة غير محدد حاليًا. يرجى التواصل مع الإدارة.'
  }

  if (message.includes('subscription period')) {
    return 'فترة الاشتراك الحالية غير صالحة أو انتهت.'
  }

  if (message.includes('unsupported target')) {
    return 'الخطة المختارة غير متاحة كترقية حاليًا.'
  }

  if (message.includes('proof file type')) {
    return 'نوع ملف إثبات الدفع غير مدعوم.'
  }

  return 'تعذر حساب طلب الترقية حاليًا. حاول مرة أخرى أو تواصل مع الدعم.'
}

/**
 * إنشاء مسودة ترقية وحساب المبلغ المستحق من قاعدة البيانات.
 *
 * لا يتم تفعيل الخطة هنا.
 * لا يتم رفع إثبات الدفع هنا.
 * تظل الخطة الحالية كما هي حتى موافقة مدير المنصة.
 */
export async function createSubscriptionUpgradeDraftAction(input: {
  targetPlanCode: string
  proofMimeType: string
}) {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  if (!isUpgradePlanCode(input.targetPlanCode)) {
    throw new Error('الخطة المختارة غير متاحة للترقية.')
  }

  if (!isProofMimeType(input.proofMimeType)) {
    throw new Error('نوع ملف إثبات الدفع غير مدعوم.')
  }

  const { data, error } = await context.supabase.rpc(
    'dokkan_create_upgrade_request',
    {
      p_target_plan_code: input.targetPlanCode,
      p_proof_mime_type: input.proofMimeType,
    }
  )

  if (error) {
    console.error('[subscription-upgrade-draft]', {
      code: error.code,
      message: error.message,
    })

    throw new Error(getUpgradeErrorMessage(error))
  }

  const result = Array.isArray(data) ? data[0] : data

  if (
    !result ||
    typeof result.request_id !== 'string' ||
    typeof result.proof_path !== 'string' ||
    typeof result.billing_cycle !== 'string' ||
    typeof result.current_plan_code !== 'string'
  ) {
    throw new Error('لم يتم استلام بيانات حساب الترقية بشكل صحيح.')
  }

  const targetPrice = Number(result.target_plan_price_egp)
  const upgradeCredit = Number(result.upgrade_credit_egp)
  const amountDue = Number(result.amount_due_egp)

  if (
    !Number.isFinite(targetPrice) ||
    !Number.isFinite(upgradeCredit) ||
    !Number.isFinite(amountDue) ||
    targetPrice < 0 ||
    upgradeCredit < 0 ||
    amountDue < 0
  ) {
    throw new Error('تعذر التحقق من المبالغ المحسوبة للترقية.')
  }

  revalidatePath('/subscription')

  return {
    ok: true as const,
    requestId: result.request_id,
    proofPath: result.proof_path,
    billingCycle: result.billing_cycle,
    currentPlanCode: result.current_plan_code,
    targetPlanCode: input.targetPlanCode,
    targetPlanPriceEgp: targetPrice,
    upgradeCreditEgp: upgradeCredit,
    amountDueEgp: amountDue,
  }
}
