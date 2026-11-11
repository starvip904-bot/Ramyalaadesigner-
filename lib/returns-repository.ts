
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function getReturnsPageData() {
  const context = await requireRedaContext()
  const { supabase, storeId } = context

  const [salesResult, returnsResult] = await Promise.all([
    supabase
      .from('dokkan_sales')
      .select(`
        id,
        store_id,
        branch_id,
        total,
        amount_paid,
        remaining,
        payment_method,
        status,
        notes,
        created_at,
        dokkan_branches(name),
        dokkan_customers(name, phone),
        dokkan_sale_items(
          id,
          product_variant_id,
          quantity,
          unit_price,
          discount,
          dokkan_product_variants(
            sku,
            size,
            color,
            dokkan_products(name)
          )
        )
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(500),

    supabase
      .from('dokkan_sale_returns')
      .select(`
        id,
        sale_id,
        branch_id,
        refund_amount,
        applied_to_balance,
        refund_method,
        notes,
        created_at,
        dokkan_sale_return_items(
          product_variant_id,
          quantity,
          amount
        )
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  if (salesResult.error) {
    console.error('[Returns] Sales query failed:', salesResult.error)
    throw new Error('تعذر تحميل فواتير المرتجعات')
  }

  if (returnsResult.error) {
    console.error('[Returns] Returns query failed:', returnsResult.error)
    throw new Error('تعذر تحميل سجل المرتجعات')
  }

  return {
    sales: salesResult.data ?? [],
    returns: returnsResult.data ?? [],
  }
}
