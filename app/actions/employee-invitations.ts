
'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type AcceptInvitationResult = {
  success: true
  storeId: string
  employeeId: string
  role: string
  branchesAssigned: number
}

function getInvitationErrorMessage(errorCode: string) {
  const messages: Record<string, string> = {
    INVITATION_NOT_FOUND: 'رابط الدعوة غير صحيح أو لم يعد صالحًا.',
    INVITATION_NOT_PENDING: 'تم استخدام هذه الدعوة أو إلغاؤها بالفعل.',
    INVITATION_EXPIRED: 'انتهت صلاحية الدعوة. اطلب إرسال دعوة جديدة.',
    INVITATION_EMAIL_MISMATCH: 'البريد المستخدم لا يطابق البريد الذي استقبل الدعوة.',
    EMPLOYEE_NOT_FOUND: 'لم يتم العثور على سجل الموظف.',
    EMPLOYEE_NOT_ACTIVE: 'حساب الموظف متوقف حاليًا.',
    EMPLOYEE_EMAIL_MISMATCH: 'البريد الإلكتروني لا يطابق بيانات الموظف.',
    EMPLOYEE_ROLE_INVALID: 'صلاحية الموظف غير صالحة.',
    INVITATION_HAS_NO_BRANCHES: 'لم يتم تحديد أي فرع لهذه الدعوة.',
    INVITATION_BRANCH_INVALID: 'أحد الفروع المحددة لم يعد نشطًا أو غير تابع للمتجر.',
    MEMBERSHIP_ALREADY_EXISTS: 'هذا الحساب مرتبط بالفعل بعضوية في المتجر.',
    SERVICE_ROLE_REQUIRED: 'تعذر إتمام التحقق الأمني للدعوة.',
    INVALID_INVITATION_INPUT: 'بيانات الدعوة غير صحيحة.',
    INVALID_EMAIL: 'البريد الإلكتروني المرتبط بالحساب غير صالح.',
  }

  return messages[errorCode] || 'تعذر قبول الدعوة. حاول مرة أخرى أو اطلب دعوة جديدة.'
}

export async function acceptEmployeeInvitation(
  rawToken: string
): Promise<AcceptInvitationResult> {
  if (
    typeof rawToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(rawToken)
  ) {
    throw new Error('رابط الدعوة غير صحيح.')
  }

  // Read the authenticated user from the server-side session.
  // Never accept a user ID or email supplied by the browser.
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('انتهت جلسة الدعوة. افتح رابط الدعوة من بريدك الإلكتروني مرة أخرى.')
  }

  const verifiedEmail = user.email?.trim().toLowerCase()

  if (!verifiedEmail || !user.email_confirmed_at) {
    throw new Error('يجب تأكيد البريد الإلكتروني أولًا من رابط الدعوة المرسل إليك.')
  }

  // The raw token is never sent to the database.
  // Only its SHA-256 hash is passed to the protected RPC.
  const tokenHash = createHash('sha256')
    .update(rawToken)
    .digest('hex')

  const admin = createAdminClient()

  const { data, error } = await admin.rpc(
    'dokkan_accept_employee_invitation',
    {
      p_token_hash: tokenHash,
      p_user_id: user.id,
      p_email: verifiedEmail,
    }
  )

  if (error) {
    console.error(
      '[Employee Invitations] Acceptance failed:',
      error.code || 'UNKNOWN',
      error.message
    )

    const errorCode = error.message
      .split(':')[0]
      .trim()
      .split(' ')[0]

    throw new Error(getInvitationErrorMessage(errorCode))
  }

  if (
    !data ||
    data.success !== true ||
    typeof data.store_id !== 'string' ||
    typeof data.employee_id !== 'string' ||
    typeof data.role !== 'string'
  ) {
    throw new Error('لم نتمكن من تأكيد ربط حساب الموظف. تواصل مع مدير المتجر.')
  }

  revalidatePath('/dashboard')
  revalidatePath('/employees')

  return {
    success: true,
    storeId: data.store_id,
    employeeId: data.employee_id,
    role: data.role,
    branchesAssigned: Number(data.branches_assigned || 0),
  }
}
