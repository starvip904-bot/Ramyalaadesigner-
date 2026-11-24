
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  requireRedaBranch,
  requireRedaContext,
  requireRedaPurchase,
} from '@/lib/reda-scope'

async function getScopedStore(storeId?: string) {
  const context = await requireRedaContext()

  if (storeId && storeId !== context.storeId) {
    throw new Error('STORE_ACCESS_DENIED')
  }

  return {
    context,
    supabase: context.supabase,
    storeId: context.storeId,
  }
}

function getCairoDateKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function getDateLabel(dateKey: string, includeMonth = false) {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'UTC',
    ...(includeMonth
      ? { day: 'numeric', month: 'numeric' }
      : { weekday: 'short' }),
  }).format(new Date(`${dateKey}T12:00:00.000Z`))
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) throw new Error('Unable to resolve authenticated user')

  return data.user
}

export async function listDokkanStores() {
  const { supabase, storeId } = await getScopedStore()

  const { data, error } = await supabase
    .from('dokkan_stores')
    .select(`
      id,
      name,
      phone,
      status,
      plan_code,
      subscription_status,
      created_at,
      dokkan_branches(id, name, address, status, created_at)
    `)
    .eq('id', storeId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Unable to load stores')

  return data ?? []
}

export async function listDokkanBranches(storeId: string) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const { data, error } = await supabase
    .from('dokkan_branches')
    .select('id, store_id, name, address, status, created_at')
    .eq('store_id', scopedStoreId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Unable to load branches')

  return data ?? []
}

export async function listDokkanProducts(storeId: string) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const { data, error } = await supabase
    .from('dokkan_products')
    .select(`
      id,
      store_id,
      name,
      category,
      brand,
      status,
      created_at,
      dokkan_product_variants(id, sku, barcode, size, color, price, cost)
    `)
    .eq('store_id', scopedStoreId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Unable to load products')

  return data ?? []
}

export async function listDokkanProductInventory(storeId: string) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const [
    { data: products, error: productsError },
    { data: branches, error: branchesError },
    { data: movements, error: movementsError },
    { data: thresholds, error: thresholdsError },
  ] = await Promise.all([
    supabase
      .from('dokkan_products')
      .select(`
        id,
        store_id,
        name,
        category,
        brand,
        status,
        created_at,
        dokkan_product_variants(id, sku, barcode, size, color, price, cost)
      `)
      .eq('store_id', scopedStoreId)
      .order('created_at', { ascending: true }),

    supabase
      .from('dokkan_branches')
      .select('id, store_id, name, address, status')
      .eq('store_id', scopedStoreId)
      .order('created_at', { ascending: true }),

    supabase
      .from('dokkan_inventory_movements')
      .select('id, store_id, branch_id, product_variant_id, movement_type, quantity, created_at')
      .eq('store_id', scopedStoreId)
      .order('created_at', { ascending: true }),

    supabase
      .from('dokkan_inventory_alert_thresholds')
      .select('id, store_id, branch_id, product_variant_id, minimum_quantity')
      .eq('store_id', scopedStoreId),
  ])

  if (
    productsError ||
    branchesError ||
    movementsError ||
    thresholdsError
  ) {
    throw new Error('Unable to load product inventory')
  }

  return {
    products: products ?? [],
    branches: branches ?? [],
    movements: movements ?? [],
    thresholds: thresholds ?? [],
  }
}

export async function createDokkanStore(_name: string, _phone?: string) {
  throw new Error('REDA_STORE_CREATION_DISABLED')
}

export async function createDokkanBranch(
  storeId: string,
  name: string,
  address?: string
) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  await requireRedaContext(['owner', 'admin'])

  const { data, error } = await supabase.rpc('dokkan_create_branch', {
    target_store_id: scopedStoreId,
    branch_name: name,
    branch_address: address ?? null,
  })

  if (error) throw new Error('Unable to create branch')

  return data as string
}

export async function recordDokkanExpense(input: {
  storeId: string
  branchId: string
  title: string
  category: string
  amount: number
  notes?: string
}) {
  const { supabase, storeId } = await getScopedStore(input.storeId)

  await requireRedaContext(['owner', 'admin'])
  await requireRedaBranch(input.branchId)

  const { data, error } = await supabase.rpc('dokkan_record_expense', {
    target_store_id: storeId,
    target_branch_id: input.branchId,
    expense_title: input.title,
    expense_category: input.category,
    expense_amount: input.amount,
    expense_notes: input.notes ?? null,
  })

  if (error) throw new Error('Unable to record expense')

  return data as string
}

export async function getCurrentMemberContext() {
  const { context } = await getScopedStore()

  return {
    user: context.user,
    member: context.membership,
    storeName: context.storeName,
    storeIds: [context.storeId],
  }
}

export async function listDokkanCustomers(
  storeId: string,
  search?: string
) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const { data, error } = await supabase.rpc('dokkan_list_customers', {
    p_store_id: scopedStoreId,
    p_search: search ?? null,
  })

  if (error) throw new Error('Unable to load customers')

  return data ?? []
}

export async function listDokkanSuppliers(
  storeId: string,
  search?: string
) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const { data, error } = await supabase.rpc('dokkan_list_suppliers', {
    p_store_id: scopedStoreId,
    p_search: search ?? null,
  })

  if (error) throw new Error('Unable to load suppliers')

  return data ?? []
}

export async function getDokkanStoreSettings(storeId: string) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const { data, error } = await supabase.rpc(
    'dokkan_get_store_settings',
    { p_store_id: scopedStoreId }
  )

  if (error) throw new Error('Unable to load store settings')

  return data
}

export async function listDokkanPurchases(
  storeId: string,
  search?: string
) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const { data, error } = await supabase.rpc('dokkan_list_purchases', {
    p_store_id: scopedStoreId,
    p_search: search ?? null,
  })

  if (error) throw new Error('Unable to load purchases')

  return data ?? []
}

export async function listDokkanSales(storeId: string) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const { data, error } = await supabase
    .from('dokkan_sales')
    .select(`
      id,
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
    .eq('store_id', scopedStoreId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[Sales] Failed to load sales:', error)
    throw new Error('تعذر تحميل فواتير المبيعات')
  }

  return data ?? []
}

export async function getDokkanPurchase(purchaseId: string) {
  const { supabase } = await getScopedStore()

  await requireRedaPurchase(purchaseId)

  const { data, error } = await supabase.rpc(
    'dokkan_get_purchase',
    { p_purchase_id: purchaseId }
  )

  if (error) throw new Error('Unable to load purchase')

  return data
}

export async function listDokkanPurchaseCatalog(storeId: string) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const [
    { data: products, error: productsError },
    { data: branches, error: branchesError },
    { data: suppliers, error: suppliersError },
  ] = await Promise.all([
    supabase
      .from('dokkan_products')
      .select(`
        id,
        name,
        store_id,
        dokkan_product_variants(id, sku, size, color, cost)
      `)
      .eq('store_id', scopedStoreId)
      .eq('status', 'active')
      .order('name'),

    supabase
      .from('dokkan_branches')
      .select('id, name, status, store_id')
      .eq('store_id', scopedStoreId)
      .eq('status', 'active')
      .order('name'),

    supabase
      .from('dokkan_suppliers')
      .select('id, name, phone')
      .eq('store_id', scopedStoreId)
      .eq('status', 'active')
      .order('name'),
  ])

  if (productsError || branchesError || suppliersError) {
    throw new Error('Unable to load purchase catalog')
  }

  return {
    products: products ?? [],
    branches: branches ?? [],
    suppliers: suppliers ?? [],
  }
}

export async function listDokkanAuditEvents(storeId: string) {
  const { supabase, storeId: scopedStoreId } =
    await getScopedStore(storeId)

  const { data, error } = await supabase
    .from('dokkan_audit_events')
    .select(`
      id,
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at,
      branch_id
    `)
    .eq('store_id', scopedStoreId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error('Unable to load audit log')

  return data ?? []
}

export async function getDashboardData() {
  const { context, supabase, storeId } = await getScopedStore()

  const now = new Date()
  const todayKey = getCairoDateKey(now)
  const monthStartKey = `${todayKey.slice(0, 7)}-01`
  const last30StartKey = shiftDateKey(todayKey, -29)

  const queryStartKey =
    monthStartKey < last30StartKey
      ? monthStartKey
      : last30StartKey

  // هامش زمني إضافي حتى لا نفقد سجلات بداية اليوم بسبب اختلاف التوقيت.
  const queryStart = new Date(
    `${shiftDateKey(queryStartKey, -1)}T00:00:00.000Z`
  ).toISOString()

  const [
    { data: sales, error: salesError },
    { data: expenses, error: expensesError },
    { data: returns, error: returnsError },
    { data: movements, error: movementsError },
    { data: thresholds, error: thresholdsError },
  ] = await Promise.all([
    supabase
      .from('dokkan_sales')
      .select(`
        id,
        total,
        status,
        created_at,
        dokkan_sale_items(
          quantity,
          unit_price,
          discount,
          dokkan_product_variants(
            dokkan_products(name)
          )
        )
      `)
      .eq('store_id', storeId)
      .gte('created_at', queryStart)
      .order('created_at', { ascending: true }),

    supabase
      .from('dokkan_expenses')
      .select('amount, created_at')
      .eq('store_id', storeId)
      .gte('created_at', queryStart)
      .order('created_at', { ascending: true }),

    supabase
      .from('dokkan_sale_returns')
      .select(`
        sale_id,
        refund_amount,
        applied_to_balance,
        created_at,
        dokkan_sale_return_items(
          quantity,
          product_variant_id,
          dokkan_product_variants(
            dokkan_products(name)
          )
        )
      `)
      .eq('store_id', storeId)
      .gte('created_at', queryStart)
      .order('created_at', { ascending: true }),

    supabase
      .from('dokkan_inventory_movements')
      .select('movement_type, quantity, product_variant_id, branch_id, created_at')
      .eq('store_id', storeId),

    supabase
      .from('dokkan_inventory_alert_thresholds')
      .select('branch_id, product_variant_id, minimum_quantity')
      .eq('store_id', storeId),
  ])

  if (
    salesError ||
    expensesError ||
    returnsError ||
    movementsError ||
    thresholdsError
  ) {
    throw new Error('Unable to load dashboard data')
  }

  const saleRows = sales ?? []
  const expenseRows = expenses ?? []
  const returnRows = returns ?? []
  const movementRows = movements ?? []

  const thresholdByInventoryKey = new Map(
    (thresholds ?? []).map((item) => [
      `${item.branch_id}:${item.product_variant_id}`,
      Number(item.minimum_quantity),
    ])
  )

  const inventory = new Map<string, number>()

  for (const movement of movementRows) {
    const sign = [
      'opening',
      'purchase',
      'return',
      'adjustment',
      'transfer_in',
    ].includes(movement.movement_type)
      ? 1
      : -1

    const key = `${movement.branch_id}:${movement.product_variant_id}`

    inventory.set(
      key,
      (inventory.get(key) ?? 0) + sign * Number(movement.quantity)
    )
  }

  const periodStartKeys = {
    '7': shiftDateKey(todayKey, -6),
    '30': last30StartKey,
    month: monthStartKey,
  }

  function buildPeriod(startKey: string) {
    const periodSales = saleRows.filter((sale) => {
      const key = getCairoDateKey(sale.created_at)
      return key >= startKey && key <= todayKey
    })

    const periodExpenses = expenseRows.filter((expense) => {
      const key = getCairoDateKey(expense.created_at)
      return key >= startKey && key <= todayKey
    })

    const periodReturns = returnRows.filter((record) => {
      const key = getCairoDateKey(record.created_at)
      return key >= startKey && key <= todayKey
    })

    const periodSaleIds = new Set(
      periodSales.map((sale) => sale.id)
    )

    const returnedByProduct = new Map<
      string,
      { name: string; quantity: number }
    >()

    for (const record of periodReturns) {
      // نخصم من المنتجات المرتجعة فقط إذا كانت فاتورة البيع الأصلية
      // ضمن الفترة المختارة، حتى لا تتأثر مبيعات فترة بمرتجعات فترة أخرى.
      if (!record.sale_id || !periodSaleIds.has(record.sale_id)) {
        continue
      }

      for (const item of record.dokkan_sale_return_items ?? []) {
        const variant = Array.isArray(item.dokkan_product_variants)
          ? item.dokkan_product_variants[0]
          : item.dokkan_product_variants

        const product = Array.isArray(variant?.dokkan_products)
          ? variant.dokkan_products[0]
          : variant?.dokkan_products

        const name = product?.name ?? 'منتج'
        const current = returnedByProduct.get(name) ?? {
          name,
          quantity: 0,
        }

        current.quantity += Number(item.quantity ?? 0)
        returnedByProduct.set(name, current)
      }
    }

    const productUnits = new Map<
      string,
      { name: string; quantity: number; total: number }
    >()

    for (const sale of periodSales) {
      for (const item of sale.dokkan_sale_items ?? []) {
        const variant = Array.isArray(item.dokkan_product_variants)
          ? item.dokkan_product_variants[0]
          : item.dokkan_product_variants

        const product = Array.isArray(variant?.dokkan_products)
          ? variant.dokkan_products[0]
          : variant?.dokkan_products

        const name = product?.name ?? 'منتج'
        const current = productUnits.get(name) ?? {
          name,
          quantity: 0,
          total: 0,
        }

        current.quantity += Number(item.quantity ?? 0)
        current.total +=
          Number(item.quantity ?? 0) * Number(item.unit_price ?? 0) -
          Number(item.discount ?? 0)

        productUnits.set(name, current)
      }
    }

    const topProducts = Array.from(productUnits.values())
      .map((product) => ({
        ...product,
        quantity: Math.max(
          0,
          product.quantity -
            (returnedByProduct.get(product.name)?.quantity ?? 0)
        ),
      }))
      .filter((product) => product.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    const dailySales = new Map<string, number>()
    const dailyReturns = new Map<string, number>()
    const dailyExpenses = new Map<string, number>()

    for (const sale of periodSales) {
      const key = getCairoDateKey(sale.created_at)
      dailySales.set(
        key,
        (dailySales.get(key) ?? 0) + Number(sale.total ?? 0)
      )
    }

    for (const record of periodReturns) {
      const key = getCairoDateKey(record.created_at)
      const returnValue =
        Number(record.refund_amount ?? 0) +
        Number(record.applied_to_balance ?? 0)

      dailyReturns.set(
        key,
        (dailyReturns.get(key) ?? 0) + returnValue
      )
    }

    for (const expense of periodExpenses) {
      const key = getCairoDateKey(expense.created_at)
      dailyExpenses.set(
        key,
        (dailyExpenses.get(key) ?? 0) + Number(expense.amount ?? 0)
      )
    }

    const salesByDay = []
    const chartDays =
      Math.round(
        (new Date(`${todayKey}T00:00:00.000Z`).getTime() -
          new Date(`${startKey}T00:00:00.000Z`).getTime()) /
          86400000
      ) + 1

    for (let index = 0; index < chartDays; index++) {
      const key = shiftDateKey(startKey, index)
      const gross = dailySales.get(key) ?? 0
      const returned = dailyReturns.get(key) ?? 0

      salesByDay.push({
        date: key,
        label: getDateLabel(key, chartDays > 7),
        total: gross - returned,
      })
    }

    const grossSales = periodSales.reduce(
      (sum, sale) => sum + Number(sale.total ?? 0),
      0
    )

    const totalReturns = periodReturns.reduce(
      (sum, record) =>
        sum +
        Number(record.refund_amount ?? 0) +
        Number(record.applied_to_balance ?? 0),
      0
    )

    return {
      salesTotal: grossSales - totalReturns,
      salesCount: periodSales.length,
      expensesTotal: periodExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount ?? 0),
        0
      ),
      salesByDay,
      topProducts,
    }
  }

  const periods = {
    '7': buildPeriod(periodStartKeys['7']),
    '30': buildPeriod(periodStartKeys['30']),
    month: buildPeriod(periodStartKeys.month),
  }

  const inventoryUnits = Array.from(inventory.values()).reduce(
    (sum, quantity) => sum + Math.max(quantity, 0),
    0
  )

  const lowStockCount = Array.from(inventory.entries()).filter(
    ([key, quantity]) => {
      const threshold = thresholdByInventoryKey.get(key) ?? 5

      return (
        threshold > 0 &&
        quantity < threshold
      )
    }
  ).length

  return {
    displayName:
      context.membership?.display_name ||
      context.user.user_metadata?.display_name ||
      context.user.email ||
      null,

    role: context.membership?.role ?? null,
    storeName: context.storeName,

    inventoryUnits,
    lowStockCount,
    periods,
  }
}
