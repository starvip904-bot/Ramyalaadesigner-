
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext } from '@/lib/reda-scope'

type EmployeeRole = 'manager' | 'cashier' | 'stock_manager' | 'viewer'

type EmployeeInput = {
  name: string
  phone?: string
  role: EmployeeRole
  branchId?: string | null
}

async function getEmployeeContext() {
  return requireRedaContext(['owner', 'admin', 'manager'])
}

async function validateBranch(
  supabase: Awaited<ReturnType<typeof getEmployeeContext>>['supabase'],
  storeId: string,
  branchId?: string | null
) {
  if (!branchId) return null

  const { data, error } = await supabase
    .from('dokkan_branches')
    .select('id')
    .eq('id', branchId)
    .eq('store_id', storeId)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    throw new Error('الفرع غير صحيح أو غير نشط')
  }

  return data.id
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

export async function createEmployee(input: EmployeeInput) {
  const context = await getEmployeeContext()
  const name = validateEmployee(input)

  const branchId = await validateBranch(
    context.supabase,
    context.storeId,
    input.branchId
  )

  const { data, error } = await context.supabase
    .from('dokkan_employees')
    .insert({
      store_id: context.storeId,
      branch_id: branchId,
      name,
      phone: input.phone?.trim() || null,
      role: input.role,
      status: 'active',
      created_by: context.user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Employees] Create failed:', error.code)
    throw new Error('تعذر إضافة الموظف')
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

  const branchId = await validateBranch(
    context.supabase,
    context.storeId,
    input.branchId
  )

  const { data, error } = await context.supabase
    .from('dokkan_employees')
    .update({
      branch_id: branchId,
      name,
      phone: input.phone?.trim() || null,
      role: input.role,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('store_id', context.storeId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('[Employees] Update failed:', error?.code)
    throw new Error('تعذر تعديل بيانات الموظف')
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

  const { data, error } = await context.supabase
    .from('dokkan_employees')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('store_id', context.storeId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('[Employees] Status update failed:', error?.code)
    throw new Error('تعذر تحديث حالة الموظف')
  }

  revalidatePath('/employees')
  return true
}
