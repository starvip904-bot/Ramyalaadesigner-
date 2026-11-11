
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function getReportsPageData() {
  const context = await requireRedaContext()
  const supabase = context.supabase
  const storeId = context.storeId

  const [
    { data: branches, error: branchesError },
    { data: sales, error: salesError },
    { data: saleItems, error: saleItemsError },
    { data: returns, error: returnsError },
    { data: returnItems, error: returnItemsError },
    { data: expenses, error: expensesError },
  ] = await Promise.all([
    supabase
      .from('dokkan_branches')
      .select('id, name, status')
      .eq('store_id', storeId)
      .order('name'),

    supabase
      .from('dokkan_sales')
      .select('id, branch_id, subtotal, discount, total, status, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(5000),

    supabase
      .from('dokkan_sale_items')
      .select('id, sale_id, product_variant_id, quantity, unit_price, discount, unit_cost')
      .limit(20000),

    supabase
      .from('dokkan_sale_returns')
      .select('id, sale_id, branch_id, refund_amount, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(10000),

    supabase
      .from('dokkan_sale_return_items')
      .select('id, return_id, product_variant_id, quantity, amount')
      .limit(20000),

    supabase
      .from('dokkan_expenses')
      .select('id, branch_id, title, category, amount, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(10000),
  ])

  if (
    branchesError ||
    salesError ||
    saleItemsError ||
    returnsError ||
    returnItemsError ||
    expensesError
  ) {
    console.error('[Reports] Failed to load report data', {
      branchesError,
      salesError,
      saleItemsError,
      returnsError,
      returnItemsError,
      expensesError,
    })

    throw new Error('تعذر تحميل بيانات التقارير')
  }

  const saleIds = new Set((sales ?? []).map((sale) => sale.id))
  const returnIds = new Set((returns ?? []).map((item) => item.id))

  return {
    branches: branches ?? [],

    sales: sales ?? [],

    saleItems: (saleItems ?? []).filter((item) =>
      saleIds.has(item.sale_id)
    ),

    returns: returns ?? [],

    returnItems: (returnItems ?? []).filter((item) =>
      returnIds.has(item.return_id)
    ),

    expenses: expenses ?? [],
  }
}
