
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

  const sales = (salesResult.data ?? []).map((sale) => {
    const branch = Array.isArray(sale.dokkan_branches)
      ? sale.dokkan_branches[0] ?? null
      : sale.dokkan_branches

    const customer = Array.isArray(sale.dokkan_customers)
      ? sale.dokkan_customers[0] ?? null
      : sale.dokkan_customers

    const items = (sale.dokkan_sale_items ?? []).map((item) => {
      const variant = Array.isArray(item.dokkan_product_variants)
        ? item.dokkan_product_variants[0] ?? null
        : item.dokkan_product_variants

      const product = variant
        ? Array.isArray(variant.dokkan_products)
          ? variant.dokkan_products[0] ?? null
          : variant.dokkan_products
        : null

      return {
        ...item,
        dokkan_product_variants: variant
          ? {
              ...variant,
              dokkan_products: product,
            }
          : null,
      }
    })

    return {
      ...sale,
      dokkan_branches: branch,
      dokkan_customers: customer,
      dokkan_sale_items: items,
    }
  })

  return {
    sales,
    returns: returnsResult.data ?? [],
  }
}
