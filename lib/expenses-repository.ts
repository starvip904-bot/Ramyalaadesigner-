
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function getExpensesPageData() {
  const context = await requireRedaContext()
  const storeId = context.storeId

  const [expensesResult, branchesResult] = await Promise.all([
    context.supabase
      .from('dokkan_expenses')
      .select(`
        id,
        store_id,
        branch_id,
        title,
        category,
        amount,
        notes,
        created_by,
        created_at
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false }),

    context.supabase
      .from('dokkan_branches')
      .select('id, name, status')
      .eq('store_id', storeId)
      .order('name', { ascending: true }),
  ])

  if (expensesResult.error) {
    console.error('[Expenses] Load failed:', expensesResult.error)
    throw new Error('تعذر تحميل المصروفات')
  }

  if (branchesResult.error) {
    console.error('[Expenses] Branches load failed:', branchesResult.error)
    throw new Error('تعذر تحميل الفروع')
  }

  const branches = branchesResult.data ?? []
  const branchNames = new Map(
    branches.map((branch) => [branch.id, branch.name])
  )

  const expenses = (expensesResult.data ?? []).map((expense) => ({
    ...expense,
    branchName: branchNames.get(expense.branch_id) ?? 'فرع غير معروف',
    amount: Number(expense.amount),
  }))

  return {
    storeId,
    branches: branches
      .filter((branch) => branch.status === 'active')
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
      })),
    expenses,
  }
}
