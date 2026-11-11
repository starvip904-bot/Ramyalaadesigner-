
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function getReportsPageData() {
  const context = await requireRedaContext()
  const supabase = context.supabase
  const storeId = context.storeId

  // Load only records belonging to the current store.
  const [
    { data: branches, error: branchesError },
    { data: sales, error: salesError },
    { data: returns, error: returnsError },
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
      .from('dokkan_sale_returns')
      .select('id, sale_id, branch_id, refund_amount, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(10000),

    supabase
      .from('dokkan_expenses')
      .select('id, branch_id, title, category, amount, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(10000),
  ])

  if (branchesError || salesError || returnsError || expensesError) {
    console.error('[Reports] Failed to load report records', {
      branchesError,
      salesError,
      returnsError,
      expensesError,
    })

    throw new Error('تعذر تحميل بيانات التقارير')
  }

  const safeSales = sales ?? []
  const safeReturns = returns ?? []

  // Include original sale IDs referenced by returns, even when
  // the original sale is older than the sales list currently loaded.
  const saleIds = Array.from(
    new Set([
      ...safeSales.map((sale) => sale.id),
      ...safeReturns.map((item) => item.sale_id),
    ])
  )

  const returnIds = safeReturns.map((item) => item.id)

  // Fetch only sale items related to this store's sales and returns.
  const saleItemsResult =
    saleIds.length > 0
      ? await supabase
          .from('dokkan_sale_items')
          .select(
            'id, sale_id, product_variant_id, quantity, unit_price, discount, unit_cost'
          )
          .in('sale_id', saleIds)
          .limit(50000)
      : { data: [], error: null }

  // Fetch only return items belonging to this store's returns.
  const returnItemsResult =
    returnIds.length > 0
      ? await supabase
          .from('dokkan_sale_return_items')
          .select('id, return_id, product_variant_id, quantity, amount')
          .in('return_id', returnIds)
          .limit(50000)
      : { data: [], error: null }

  if (saleItemsResult.error || returnItemsResult.error) {
    console.error('[Reports] Failed to load report item records', {
      saleItemsError: saleItemsResult.error,
      returnItemsError: returnItemsResult.error,
    })

    throw new Error('تعذر تحميل تفاصيل بنود التقارير')
  }

  return {
    branches: branches ?? [],
    sales: safeSales,
    saleItems: saleItemsResult.data ?? [],
    returns: safeReturns,
    returnItems: returnItemsResult.data ?? [],
    expenses: expenses ?? [],
  }
}
