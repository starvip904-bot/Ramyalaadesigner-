
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext } from '@/lib/reda-scope'

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

  // المدير مسموح له بالاسم والهاتف فقط.
  // نرفض أي حقول إضافية حتى لو تم إرسالها يدويًا من المتصفح.
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
