
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function getReturnsPageData() {
  const context = await requireRedaContext()
  const { supabase, storeId } = context

  const [salesResult, returnsResult, requestsResult] =
    await Promise.all([
      supabase
        .from('dokkan_sales')
        .select(`
          id,
          store_id,
          branch_id,
          subtotal,
          discount,
          tax_enabled,
          tax_rate,
          tax_amount,
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
            amount,
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
        .limit(1000),

      supabase
        .from('dokkan_sale_return_requests')
        .select(`
          id,
          store_id,
          sale_id,
          branch_id,
          status,
          requested_refund_method,
          notes,
          created_by,
          created_at,
          decided_by,
          decided_at,
          decision_notes,
          processed_return_id
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

  if (requestsResult.error) {
    console.error('[Returns] Requests query failed:', requestsResult.error)
    throw new Error('تعذر تحميل طلبات المرتجعات')
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

  const salesById = new Map(
    sales.map((sale) => [sale.id, sale])
  )

  const returns = (returnsResult.data ?? []).map((record) => {
    const items = (record.dokkan_sale_return_items ?? []).map((item) => {
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
      ...record,
      dokkan_sale_return_items: items,
      original_sale: salesById.get(record.sale_id) ?? null,
    }
  })

  const requestIds = (requestsResult.data ?? []).map(
    (request) => request.id
  )

  const requestItemsResult =
    requestIds.length > 0
      ? await supabase
          .from('dokkan_sale_return_request_items')
          .select(`
            id,
            request_id,
            product_variant_id,
            quantity,
            dokkan_product_variants(
              sku,
              size,
              color,
              dokkan_products(name)
            )
          `)
          .in('request_id', requestIds)
      : { data: [], error: null }

  if (requestItemsResult.error) {
    console.error(
      '[Returns] Request items query failed:',
      requestItemsResult.error
    )
    throw new Error('تعذر تحميل أصناف طلبات المرتجعات')
  }

  const requestItemsById = new Map<string, typeof requestItemsResult.data>()

  for (const item of requestItemsResult.data ?? []) {
    const current = requestItemsById.get(item.request_id) ?? []
    current.push(item)
    requestItemsById.set(item.request_id, current)
  }

  const requests = (requestsResult.data ?? []).map((request) => {
    const items = (requestItemsById.get(request.id) ?? []).map((item) => {
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
      ...request,
      items,
      original_sale: salesById.get(request.sale_id) ?? null,
    }
  })

  return {
    sales,
    returns,
    requests,
  }
}
