
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext } from '@/lib/reda-scope'
import { createAdminClient } from '@/lib/supabase/admin'

type EmployeeRole = 'manager' | 'cashier' | 'stock_manager' | 'viewer'

type EmployeeInput = {
  name: string
  phone?: string
  email?: string
  role: EmployeeRole
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

function validateEmployee(input: EmployeeInput) {
  const name = input.name?.trim()

  if (!name || name.length < 2 || name.length > 120) {
    throw new Error('اسم الموظف يجب أن يكون من 2 إلى 120 حرفًا')
  }

  if (input.phone && input.phone.trim().length > 40) {
    throw new Error('رقم الهاتف أطول من المسموح')
  }

  const roles: EmployeeRole[] = [
    'manager',
    'cashier',
    'stock_manager',
    'viewer',
  ]

  if (!roles.includes(input.role)) {
    throw new Error('نوع الموظف غير صحيح')
  }

  return name
}

async function validateBranches(
  supabase: Awaited<ReturnType<typeof getEmployeeContext>>['supabase'],
  storeId: string,
  input: EmployeeInput
) {
  const requested = input.branchIds !== undefined
    ? input.branchIds
    : input.branchId
      ? [input.branchId]
      : []

  const branchIds = [...new Set(requested.filter(Boolean))]

  if (branchIds.length !== requested.length) {
    throw new Error('يوجد فرع مكرر في الاختيارات')
  }

  if (branchIds.length === 0) return []

  const { data, error } = await supabase
    .from('dokkan_branches')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .in('id', branchIds)

  if (error || !data || data.length !== branchIds.length) {
    throw new Error('أحد الفروع المختارة غير صحيح أو غير نشط أو ليس لديك صلاحية عليه')
  }

  return branchIds
}

/**
 * Synchronizes the employee's permanent branch assignments.
 * Uses a server-side RPC restricted to service_role.
 */
async function saveEmployeeBranches(params: {
  storeId: string
  employeeId: string
  branchIds: string[]
}) {
  const admin = createAdminClient()

  const { error } = await admin.rpc('dokkan_set_employee_branches', {
    target_store_id: params.storeId,
    target_employee_id: params.employeeId,
    target_branch_ids: params.branchIds,
  })

  if (error) {
    console.error('[Employees] Branch assignments save failed:', error.code)
    throw new Error('تعذر حفظ فروع الموظف')
  }
}

/**
 * Saves invitation metadata only.
 * This function never creates an Auth user and never sends an email.
 */
async function saveInvitationDraft(params: {
  storeId: string
  employeeId: string
  email: string | null
  invitedBy: string
  branchIds: string[]
}) {
  const admin = createAdminClient()

  const {
    storeId,
    employeeId,
    email,
    invitedBy,
    branchIds,
  } = params

  const { data: existing, error: lookupError } = await admin
    .from('dokkan_employee_invitations')
    .select('id, status, email')
    .eq('store_id', storeId)
    .eq('employee_id', employeeId)
    .in('status', ['draft', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    throw new Error('تعذر التحقق من حالة دعوة الموظف')
  }

  if (existing?.status === 'pending') {
    throw new Error(
      'هناك دعوة مرسلة بالفعل لهذا الموظف. لا يمكن تغيير بيانات دعوتها الآن'
    )
  }

  if (!email) {
    if (existing?.status === 'draft') {
      const { error } = await admin
        .from('dokkan_employee_invitations')
        .update({
          status: 'cancelled',
          token_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('store_id', storeId)

      if (error) {
        throw new Error('تعذر إلغاء مسودة الدعوة')
      }
    }

    return
  }

  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString()

  let invitationId: string

  if (existing?.status === 'draft') {
    const { data, error } = await admin
      .from('dokkan_employee_invitations')
      .update({
        email,
        invited_by: invitedBy,
        expires_at: expiresAt,
        token_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('store_id', storeId)
      .select('id')
      .single()

    if (error || !data) {
      throw new Error('تعذر تحديث مسودة دعوة الموظف')
    }

    invitationId = data.id
  } else {
    const { data, error } = await admin
      .from('dokkan_employee_invitations')
      .insert({
        store_id: storeId,
        employee_id: employeeId,
        email,
        status: 'draft',
        invited_by: invitedBy,
        expires_at: expiresAt,
        token_hash: null,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[Employees] Draft creation failed:', error?.code)
      throw new Error('تعذر إنشاء مسودة دعوة الموظف')
    }

    invitationId = data.id
  }

  const { error: deleteBranchesError } = await admin
    .from('dokkan_employee_invitation_branches')
    .delete()
    .eq('invitation_id', invitationId)
    .eq('store_id', storeId)

  if (deleteBranchesError) {
    throw new Error('تعذر تحديث فروع الدعوة')
  }

  if (branchIds.length > 0) {
    const { error } = await admin
      .from('dokkan_employee_invitation_branches')
      .insert(
        branchIds.map((branchId) => ({
          invitation_id: invitationId,
          store_id: storeId,
          branch_id: branchId,
        }))
      )

    if (error) {
      console.error('[Employees] Draft branches failed:', error.code)
      throw new Error('تعذر حفظ فروع الدعوة')
    }
  }
}

export async function createEmployee(input: EmployeeInput) {
  const context = await getEmployeeContext()
  const name = validateEmployee(input)
  const email = normalizeEmail(input.email)

  const branchIds = await validateBranches(
    context.supabase,
    context.storeId,
    input
  )

  const { data, error } = await context.supabase
    .from('dokkan_employees')
    .insert({
      store_id: context.storeId,
      branch_id: branchIds[0] || null,
      name,
      phone: input.phone?.trim() || null,
      ...(input.email !== undefined ? { email } : {}),
      role: input.role,
      status: 'active',
      created_by: context.user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Employees] Create failed:', error?.code)
    throw new Error('تعذر إضافة الموظف')
  }

  try {
    await saveEmployeeBranches({
      storeId: context.storeId,
      employeeId: data.id,
      branchIds,
    })

    if (input.email !== undefined) {
      await saveInvitationDraft({
        storeId: context.storeId,
        employeeId: data.id,
        email,
        invitedBy: context.user.id,
        branchIds,
      })
    }
  } catch (err) {
    await context.supabase
      .from('dokkan_employees')
      .delete()
      .eq('id', data.id)
      .eq('store_id', context.storeId)

    throw err
  }

  revalidatePath('/employees')
  return data.id as string
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput
) {
  const context = await getEmployeeContext()
  const name = validateEmployee(input)

  if (!id) throw new Error('معرف الموظف غير صحيح')

  const email = input.email !== undefined
    ? normalizeEmail(input.email)
    : undefined

  const branchIds = await validateBranches(
    context.supabase,
    context.storeId,
    input
  )

  const updateData: Record<string, unknown> = {
    branch_id: branchIds[0] || null,
    name,
    phone: input.phone?.trim() || null,
    role: input.role,
    updated_at: new Date().toISOString(),
  }

  if (input.email !== undefined) {
    updateData.email = email
  }

  const { data, error } = await context.supabase
    .from('dokkan_employees')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', context.storeId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('[Employees] Update failed:', error?.code)
    throw new Error('تعذر تعديل بيانات الموظف')
  }

  await saveEmployeeBranches({
    storeId: context.storeId,
    employeeId: id,
    branchIds,
  })

  if (input.email !== undefined) {
    await saveInvitationDraft({
      storeId: context.storeId,
      employeeId: id,
      email: email ?? null,
      invitedBy: context.user.id,
      branchIds,
    })
  }

  revalidatePath('/employees')
  return data.id as string
}

export async function setEmployeeStatus(
  id: string,
  status: 'active' | 'inactive'
) {
  const context = await getEmployeeContext()

  if (!id || !['active', 'inactive'].includes(status)) {
    throw new Error('بيانات الموظف غير صحيحة')
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
    console.error(
      '[Employees] Status RPC failed:',
      error?.code
    )
    throw new Error('تعذر تحديث حالة الموظف')
  }

  revalidatePath('/employees')
  return true
}
