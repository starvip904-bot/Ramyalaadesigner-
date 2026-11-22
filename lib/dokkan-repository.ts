
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
  ])

  if (productsError || branchesError || movementsError) {
    throw new Error('Unable to load product inventory')
  }

  return {
    products: products ?? [],
    branches: branches ?? [],
    movements: movements ?? [],
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

  const [
    { data: sales, error: salesError },
    { data: expenses, error: expensesError },
    { data: movements, error: movementsError },
  ] = await Promise.all([
    supabase
      .from('dokkan_sales')
      .select(`
        id,
        total,
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
      .eq('store_id', storeId),

    supabase
      .from('dokkan_expenses')
      .select('amount')
      .eq('store_id', storeId),

    supabase
      .from('dokkan_inventory_movements')
      .select('movement_type, quantity, product_variant_id, branch_id, created_at')
      .eq('store_id', storeId),
  ])

  if (salesError || expensesError || movementsError) {
    throw new Error('Unable to load dashboard data')
  }

  const saleRows = sales ?? []
  const movementRows = movements ?? []

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
      (inventory.get(key) ?? 0) + sign * movement.quantity
    )
  }

  const productUnits = new Map<
    string,
    { name: string; quantity: number; total: number }
  >()

  for (const sale of saleRows) {
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

      current.quantity += item.quantity
      current.total +=
        item.quantity * Number(item.unit_price) -
        Number(item.discount)

      productUnits.set(name, current)
    }
  }

  const salesByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(
      Date.now() - (6 - index) * 24 * 60 * 60 * 1000
    )

    const key = date.toISOString().slice(0, 10)

    return {
      label: date.toLocaleDateString('ar-EG', {
        weekday: 'short',
        timeZone: 'Africa/Cairo',
      }),
      total: saleRows
        .filter((sale) => sale.created_at.slice(0, 10) === key)
        .reduce((sum, sale) => sum + Number(sale.total), 0),
    }
  })

  return {
    displayName:
      context.membership?.display_name ||
      context.user.user_metadata?.display_name ||
      context.user.email ||
      null,

    role: context.membership?.role ?? null,
    storeName: context.storeName,

    salesTotal: saleRows.reduce(
      (sum, sale) => sum + Number(sale.total),
      0
    ),

    salesCount: saleRows.length,

    expensesTotal: (expenses ?? []).reduce(
      (sum, expense) => sum + Number(expense.amount),
      0
    ),

    inventoryUnits: Array.from(inventory.values()).reduce(
      (sum, quantity) => sum + Math.max(quantity, 0),
      0
    ),

    lowStockCount: Array.from(inventory.values()).filter(
      (quantity) => quantity > 0 && quantity < 5
    ).length,

    salesByDay,

    topProducts: Array.from(productUnits.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5),
  }
}
