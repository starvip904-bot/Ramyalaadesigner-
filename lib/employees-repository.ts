
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function getEmployeesPageData() {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  const [employeesResult, branchesResult] = await Promise.all([
    context.supabase
      .from('dokkan_employees')
      .select(`
        id,
        name,
        phone,
        role,
        status,
        branch_id,
        created_at,
        updated_at
      `)
      .eq('store_id', context.storeId)
      .order('created_at', { ascending: false }),

    context.supabase
      .from('dokkan_branches')
      .select('id, name, status')
      .eq('store_id', context.storeId)
      .order('created_at', { ascending: true }),
  ])

  if (employeesResult.error) {
    console.error(
      '[Employees] Load failed:',
      employeesResult.error.code
    )
    throw new Error('تعذر تحميل الموظفين')
  }

  if (branchesResult.error) {
    console.error(
      '[Employees] Branches load failed:',
      branchesResult.error.code
    )
    throw new Error('تعذر تحميل الفروع')
  }

  return {
    storeId: context.storeId,
    employees: employeesResult.data ?? [],
    branches: branchesResult.data ?? [],
  }
}
