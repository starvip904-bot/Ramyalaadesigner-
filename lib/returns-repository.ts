
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function getReturnsPageData() {
  const context = await requireRedaContext()
  const { supabase, storeId } = context

  const [
    salesResult,
    returnsResult,
    requestsResult,
    variantsResult,
    movementsResult,
  ] = await Promise.all([
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
        return_type,
        refund_amount,
        applied_to_balance,
        refund_method,
        exchange_difference,
        exchange_payment_method,
        exchange_difference_direction,
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
        ),
        dokkan_sale_return_exchange_items(
          id,
          product_variant_id,
          quantity,
          unit_price,
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
        return_type,
        status,
        requested_refund_method,
        exchange_difference,
        exchange_payment_method,
        exchange_difference_direction,
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

    supabase
      .from('dokkan_product_variants')
      .select(`
        id,
        product_id,
        sku,
        barcode,
        size,
        color,
        price,
        dokkan_products!inner(name, status)
      `)
      .eq('store_id', storeId)
      .eq('dokkan_products.status', 'active')
      .order('created_at', { ascending: false })
      .limit(2000),

    supabase
      .from('dokkan_inventory_movements')
      .select(`
        branch_id,
        product_variant_id,
        movement_type,
        quantity
      `)
      .eq('store_id', storeId)
      .limit(10000),
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

  if (variantsResult.error) {
    console.error('[Returns] Product variants query failed:', variantsResult.error)
    throw new Error('تعذر تحميل أصناف الاستبدال')
  }

  if (movementsResult.error) {
    console.error('[Returns] Inventory movements query failed:', movementsResult.error)
    throw new Error('تعذر تحميل كميات المخزون للاستبدال')
  }

  const sales = (salesResult.data ?? []).map((sale) => {
    const branch = normalizeOne(sale.dokkan_branches)
    const customer = normalizeOne(sale.dokkan_customers)

    const items = (sale.dokkan_sale_items ?? []).map((item) => {
      const variant = normalizeOne(item.dokkan_product_variants)
      const product = variant
        ? normalizeOne(variant.dokkan_products)
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
      const variant = normalizeOne(item.dokkan_product_variants)
      const product = variant
        ? normalizeOne(variant.dokkan_products)
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

    const exchangeItems = (
      record.dokkan_sale_return_exchange_items ?? []
    ).map((item) => {
      const variant = normalizeOne(item.dokkan_product_variants)
      const product = variant
        ? normalizeOne(variant.dokkan_products)
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
      dokkan_sale_return_exchange_items: exchangeItems,
      original_sale: salesById.get(record.sale_id) ?? null,
    }
  })

  const requestIds = (requestsResult.data ?? []).map(
    (request) => request.id
  )

  const [
    requestItemsResult,
    exchangeRequestItemsResult,
    settlementsResult,
  ] = await Promise.all([
    requestIds.length > 0
      ? supabase
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
      : Promise.resolve({ data: [], error: null }),

    requestIds.length > 0
      ? supabase
          .from('dokkan_sale_return_exchange_request_items')
          .select(`
            id,
            request_id,
            product_variant_id,
            quantity,
            unit_price,
            amount,
            dokkan_product_variants(
              sku,
              size,
              color,
              dokkan_products(name)
            )
          `)
          .in('request_id', requestIds)
      : Promise.resolve({ data: [], error: null }),

    requestIds.length > 0
      ? supabase
          .from('dokkan_sale_exchange_settlements')
          .select(`
            id,
            sale_id,
            branch_id,
            request_id,
            return_id,
            settlement_type,
            amount,
            payment_method,
            created_at
          `)
          .eq('store_id', storeId)
          .in('request_id', requestIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (requestItemsResult.error) {
    console.error(
      '[Returns] Request items query failed:',
      requestItemsResult.error
    )
    throw new Error('تعذر تحميل أصناف طلبات المرتجعات')
  }

  if (exchangeRequestItemsResult.error) {
    console.error(
      '[Returns] Exchange request items query failed:',
      exchangeRequestItemsResult.error
    )
    throw new Error('تعذر تحميل أصناف الاستبدال المطلوبة')
  }

  if (settlementsResult.error) {
    console.error(
      '[Returns] Exchange settlements query failed:',
      settlementsResult.error
    )
    throw new Error('تعذر تحميل تسويات فروق أسعار الاستبدال')
  }

  const requestItemsById = new Map<string, typeof requestItemsResult.data>()
  const exchangeItemsById = new Map<
    string,
    typeof exchangeRequestItemsResult.data
  >()

  for (const item of requestItemsResult.data ?? []) {
    const current = requestItemsById.get(item.request_id) ?? []
    current.push(item)
    requestItemsById.set(item.request_id, current)
  }

  for (const item of exchangeRequestItemsResult.data ?? []) {
    const current = exchangeItemsById.get(item.request_id) ?? []
    current.push(item)
    exchangeItemsById.set(item.request_id, current)
  }

  const requests = (requestsResult.data ?? []).map((request) => {
    const items = (requestItemsById.get(request.id) ?? []).map((item) => {
      const variant = normalizeOne(item.dokkan_product_variants)
      const product = variant
        ? normalizeOne(variant.dokkan_products)
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

    const exchangeItems = (
      exchangeItemsById.get(request.id) ?? []
    ).map((item) => {
      const variant = normalizeOne(item.dokkan_product_variants)
      const product = variant
        ? normalizeOne(variant.dokkan_products)
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
      exchangeItems,
      original_sale: salesById.get(request.sale_id) ?? null,
    }
  })

  // حساب الرصيد الفعلي لكل صنف داخل كل فرع من سجل الحركات.
  const stockByBranchAndVariant = new Map<string, number>()

  const positiveMovementTypes = [
    'opening',
    'purchase',
    'return',
    'adjustment',
    'transfer_in',
  ]

  const negativeMovementTypes = [
    'sale',
    'transfer_out',
    'damage',
  ]

  for (const movement of movementsResult.data ?? []) {
    const key = `${movement.branch_id}:${movement.product_variant_id}`

    const sign = positiveMovementTypes.includes(movement.movement_type)
      ? 1
      : negativeMovementTypes.includes(movement.movement_type)
        ? -1
        : 0

    stockByBranchAndVariant.set(
      key,
      (stockByBranchAndVariant.get(key) ?? 0) +
        sign * Number(movement.quantity)
    )
  }

  const exchangeProducts = (variantsResult.data ?? []).map((variant) => {
    const product = normalizeOne(variant.dokkan_products)

    const stockByBranch: Record<string, number> = {}

    for (const [key, quantity] of stockByBranchAndVariant.entries()) {
      const separatorIndex = key.indexOf(':')
      const branchId = key.slice(0, separatorIndex)
      const variantId = key.slice(separatorIndex + 1)

      if (variantId === variant.id) {
        stockByBranch[branchId] = quantity
      }
    }

    return {
      id: variant.id,
      productId: variant.product_id,
      name: product?.name ?? 'منتج',
      sku: variant.sku,
      barcode: variant.barcode,
      size: variant.size,
      color: variant.color,
      price: Number(variant.price),
      stockByBranch,
    }
  })

  return {
    sales,
    returns,
    requests,
    exchangeProducts,
    exchangeSettlements: settlementsResult.data ?? [],
  }
}
