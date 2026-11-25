
'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'

import { requireRedaContext } from '@/lib/reda-scope'
import { createAdminClient } from '@/lib/supabase/admin'

type EmployeeRole = 'manager' | 'cashier' | 'stock_manager' | 'viewer'

type EmployeeInput = {
  name: string
  phone?: string
  email?: string
  role?: EmployeeRole
  branchId?: string | null
  branchIds?: string[]
}

async function getEmployeeContext() {
  return requireRedaContext(['owner', 'admin', 'manager'])
}

function normalizeEmail(value?: string) {
  const email = value?.trim().toLowerCase() || ''

  if (!email) return null

  if (
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('البريد الإلكتروني غير صحيح')
  }

  return email
}

function validateNameAndPhone(input: EmployeeInput) {
  const name = input.name?.trim()

  if (!name || name.length < 2 || name.length > 120) {
    throw new Error('اسم الموظف يجب أن يكون من 2 إلى 120 حرفًا')
  }

  if (input.phone && input.phone.trim().length > 40) {
    throw new Error('رقم الهاتف أطول من المسموح')
  }

  return name
}

function validateRole(role?: EmployeeRole) {
  const roles: EmployeeRole[] = [
    'manager',
    'cashier',
    'stock_manager',
    'viewer',
  ]

  if (!role || !roles.includes(role)) {
    throw new Error('نوع الموظف غير صحيح')
  }

  return role
}

function getRequestedBranchIds(input: EmployeeInput) {
  const requested = input.branchIds !== undefined
    ? input.branchIds
    : input.branchId
      ? [input.branchId]
      : []

  const branchIds = [...new Set(requested.filter(Boolean))]

  if (branchIds.length !== requested.length) {
    throw new Error('يوجد فرع مكرر في الاختيارات')
  }

  return branchIds
}

function getApplicationOrigin(requestHeaders: Headers) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null)

  if (configuredUrl) {
    return new URL(configuredUrl).origin
  }

  const host =
    requestHeaders.get('x-forwarded-host') ||
    requestHeaders.get('host')

  if (!host) {
    throw new Error('تعذر تحديد عنوان الموقع لإرسال الدعوة')
  }

  const protocol =
    requestHeaders.get('x-forwarded-proto') ||
    (host.startsWith('localhost') ? 'http' : 'https')

  return `${protocol}://${host}`
}

function createInvitationRedirectUrl(origin: string, token: string) {
  const callbackUrl = new URL('/auth/callback', origin)

  callbackUrl.searchParams.set(
    'next',
    `/employee-invite/accept?token=${encodeURIComponent(token)}`
  )

  return callbackUrl.toString()
}

export async function sendEmployeeInvitation(employeeId: string) {
  const context = await getEmployeeContext()

  if (!['owner', 'admin'].includes(context.membership.role)) {
    throw new Error('ليس لديك صلاحية إرسال دعوات الموظفين')
  }

  if (!employeeId) {
    throw new Error('معرف الموظف غير صحيح')
  }

  const admin = createAdminClient()

  const { data: employee, error: employeeError } = await admin
    .from('dokkan_employees')
    .select('id, store_id, name, email, role, status')
    .eq('id', employeeId)
    .eq('store_id', context.storeId)
    .maybeSingle()

  if (employeeError || !employee) {
    throw new Error('لم يتم العثور على الموظف داخل متجرك')
  }

  if (employee.status !== 'active') {
    throw new Error('لا يمكن دعوة موظف متوقف')
  }

  const email = normalizeEmail(employee.email || undefined)

  if (!email) {
    throw new Error('أضف البريد الإلكتروني للموظف أولًا')
  }

  const { data: linkedMembership, error: membershipError } =
    await admin
      .from('dokkan_members')
      .select('id')
      .eq('store_id', context.storeId)
      .eq('employee_id', employeeId)
      .maybeSingle()

  if (membershipError) {
    console.error(
      '[Employees] Membership lookup failed:',
      membershipError.code
    )
    throw new Error('تعذر التحقق من حساب الموظف')
  }

  if (linkedMembership) {
    throw new Error('هذا الموظف مرتبط بالفعل بحساب دخول')
  }

  const { data: branchRows, error: branchesError } = await admin
    .from('dokkan_employee_branches')
    .select('branch_id')
    .eq('employee_id', employeeId)
    .eq('store_id', context.storeId)

  if (branchesError) {
    console.error(
      '[Employees] Branch lookup failed:',
      branchesError.code
    )
    throw new Error('تعذر قراءة فروع الموظف')
  }

  const branchIds = (branchRows || [])
    .map((row) => row.branch_id)
    .filter(Boolean)

  if (branchIds.length === 0) {
    throw new Error('حدد فرعًا واحدًا على الأقل للموظف قبل إرسال الدعوة')
  }

  const { data: existingInvitations, error: invitationsError } =
    await admin
      .from('dokkan_employee_invitations')
      .select('id, status, token_hash, expires_at, email')
      .eq('store_id', context.storeId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(1)

  if (invitationsError) {
    console.error(
      '[Employees] Invitation lookup failed:',
      invitationsError.code
    )
    throw new Error('تعذر قراءة حالة دعوة الموظف')
  }

  const previousInvitation = existingInvitations?.[0] || null

  if (previousInvitation?.status === 'accepted') {
    throw new Error('تم قبول دعوة هذا الموظف بالفعل')
  }

  const rawToken = randomBytes(32).toString('hex')

  const tokenHash = createHash('sha256')
    .update(rawToken)
    .digest('hex')

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  const requestHeaders = await headers()
  const origin = getApplicationOrigin(requestHeaders)
  const redirectUrl = createInvitationRedirectUrl(origin, rawToken)

  const oldInvitationBranches = previousInvitation
    ? await admin
        .from('dokkan_employee_invitation_branches')
        .select('branch_id')
        .eq('invitation_id', previousInvitation.id)
        .eq('store_id', context.storeId)
    : { data: [], error: null }

  if (oldInvitationBranches.error) {
    throw new Error('تعذر قراءة فروع الدعوة السابقة')
  }

  let invitationId = previousInvitation?.id

  if (previousInvitation) {
    const { error } = await admin
      .from('dokkan_employee_invitations')
      .update({
        email,
        status: 'pending',
        token_hash: tokenHash,
        expires_at: expiresAt,
        accepted_user_id: null,
        accepted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', previousInvitation.id)
      .eq('store_id', context.storeId)

    if (error) {
      console.error('[Employees] Invitation update failed:', error.code)
      throw new Error('تعذر تجهيز دعوة الموظف')
    }
  } else {
    const { data, error } = await admin
      .from('dokkan_employee_invitations')
      .insert({
        store_id: context.storeId,
        employee_id: employeeId,
        email,
        status: 'pending',
        invited_by: context.user.id,
        expires_at: expiresAt,
        token_hash: tokenHash,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[Employees] Invitation insert failed:', error?.code)
      throw new Error('تعذر إنشاء دعوة الموظف')
    }

    invitationId = data.id
  }

  if (!invitationId) {
    throw new Error('تعذر تحديد سجل الدعوة')
  }

  const { error: deleteBranchesError } = await admin
    .from('dokkan_employee_invitation_branches')
    .delete()
    .eq('invitation_id', invitationId)
    .eq('store_id', context.storeId)

  if (deleteBranchesError) {
    throw new Error('تعذر تحديث فروع الدعوة')
  }

  const { error: insertBranchesError } = await admin
    .from('dokkan_employee_invitation_branches')
    .insert(
      branchIds.map((branchId) => ({
        invitation_id: invitationId,
        store_id: context.storeId,
        branch_id: branchId,
      }))
    )

  if (insertBranchesError) {
    throw new Error('تعذر حفظ فروع الدعوة')
  }

  // Send a real Supabase Auth invitation.
  // The custom token is passed only in the post-verification redirect.
  const { error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        dokkan_employee_invitation: invitationId,
      },
    })

  if (inviteError) {
    console.error(
      '[Employees] Auth invitation failed:',
      inviteError.message
    )

    if (previousInvitation) {
      await admin
        .from('dokkan_employee_invitations')
        .update({
          email: previousInvitation.email,
          status: previousInvitation.status,
          token_hash: previousInvitation.token_hash,
          expires_at: previousInvitation.expires_at,
          accepted_user_id: null,
          accepted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', previousInvitation.id)
        .eq('store_id', context.storeId)

      await admin
        .from('dokkan_employee_invitation_branches')
        .delete()
        .eq('invitation_id', previousInvitation.id)
        .eq('store_id', context.storeId)

      if (oldInvitationBranches.data?.length) {
        await admin
          .from('dokkan_employee_invitation_branches')
          .insert(
            oldInvitationBranches.data.map((row) => ({
              invitation_id: previousInvitation.id,
              store_id: context.storeId,
              branch_id: row.branch_id,
            }))
          )
      }
    } else {
      await admin
        .from('dokkan_employee_invitations')
        .update({
          status: 'cancelled',
          token_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId)
        .eq('store_id', context.storeId)
    }

    throw new Error(
      'تعذر إرسال الدعوة. قد يكون البريد مرتبطًا بحساب موجود بالفعل، أو توجد مشكلة في إعدادات البريد في Supabase'
    )
  }

  revalidatePath('/employees')

  return {
    success: true,
    expiresAt,
    message: 'تم إرسال دعوة إنشاء الحساب إلى البريد الإلكتروني',
  }
}

export async function createEmployee(input: EmployeeInput) {
  const context = await getEmployeeContext()
  const name = validateNameAndPhone(input)
  const role = validateRole(input.role)
  const email = normalizeEmail(input.email)
  const branchIds = getRequestedBranchIds(input)

  if (!['owner', 'admin'].includes(context.membership.role)) {
    throw new Error('ليس لديك صلاحية إضافة موظفين')
  }

  const { data, error } = await context.supabase.rpc(
    'dokkan_create_employee',
    {
      p_store_id: context.storeId,
      p_name: name,
      p_phone: input.phone?.trim() || null,
      p_email: email,
      p_role: role,
      p_branch_ids: branchIds,
      p_create_invitation: input.email !== undefined,
    }
  )

  if (error || !data) {
    console.error('[Employees] Create RPC failed:', error?.code)
    throw new Error('تعذر إضافة الموظف')
  }

  revalidatePath('/employees')
  return data as string
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput
) {
  const context = await getEmployeeContext()

  if (!id) {
    throw new Error('معرف الموظف غير صحيح')
  }

  const name = validateNameAndPhone(input)
  const callerRole = context.membership.role
  const isManager = callerRole === 'manager'
  const isOwnerOrAdmin = ['owner', 'admin'].includes(callerRole)

  if (!isManager && !isOwnerOrAdmin) {
    throw new Error('ليس لديك صلاحية تعديل الموظفين')
  }

  if (
    isManager &&
    (
      input.email !== undefined ||
      input.role !== undefined ||
      input.branchIds !== undefined ||
      input.branchId !== undefined
    )
  ) {
    throw new Error('المدير يستطيع تعديل الاسم ورقم الهاتف فقط')
  }

  const emailProvided = isOwnerOrAdmin && input.email !== undefined
  const branchesProvided = isOwnerOrAdmin && (
    input.branchIds !== undefined ||
    input.branchId !== undefined
  )

  const email = emailProvided
    ? normalizeEmail(input.email)
    : null

  const branchIds = branchesProvided
    ? getRequestedBranchIds(input)
    : []

  const role = isOwnerOrAdmin && input.role !== undefined
    ? validateRole(input.role)
    : null

  const { data, error } = await context.supabase.rpc(
    'dokkan_update_employee',
    {
      p_store_id: context.storeId,
      p_employee_id: id,
      p_name: name,
      p_phone: input.phone?.trim() || null,
      p_email: email,
      p_email_provided: emailProvided,
      p_role: role,
      p_branch_ids: branchIds,
      p_branches_provided: branchesProvided,
    }
  )

  if (error || !data) {
    console.error('[Employees] Update RPC failed:', error?.code)
    throw new Error('تعذر تعديل بيانات الموظف')
  }

  revalidatePath('/employees')
  return data as string
}

export async function setEmployeeStatus(
  id: string,
  status: 'active' | 'inactive'
) {
  const context = await getEmployeeContext()

  if (!id || !['active', 'inactive'].includes(status)) {
    throw new Error('بيانات الموظف غير صحيحة')
  }

  if (!['owner', 'admin'].includes(context.membership.role)) {
    throw new Error('ليس لديك صلاحية تغيير حالة الموظف')
  }

  const { data, error } = await context.supabase.rpc(
    'dokkan_set_employee_status',
    {
      p_store_id: context.storeId,
      p_employee_id: id,
      p_next_status: status,
    }
  )

  if (error || !data) {
    console.error('[Employees] Status RPC failed:', error?.code)
    throw new Error('تعذر تحديث حالة الموظف')
  }

  revalidatePath('/employees')
  return true
}
