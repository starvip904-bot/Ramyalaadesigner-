import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) throw new Error('Unable to resolve authenticated user')
  return data.user
}

export async function listDokkanStores() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('dokkan_stores').select('id, name, phone, status, created_at, dokkan_branches(id, name, address, status, created_at)').order('created_at', { ascending: true })
  if (error) throw new Error('Unable to load stores')
  return data
}

export async function listDokkanBranches(storeId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('dokkan_branches').select('id, store_id, name, address, status, created_at').eq('store_id', storeId).order('created_at', { ascending: true })
  if (error) throw new Error('Unable to load branches')
  return data
}

export async function listDokkanProducts(storeId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('dokkan_products').select('id, store_id, name, category, brand, status, created_at, dokkan_product_variants(id, sku, barcode, size, color, price, cost)').eq('store_id', storeId).order('created_at', { ascending: true })
  if (error) throw new Error('Unable to load products')
  return data
}

export async function listDokkanProductInventory() {
  const supabase = await createClient()
  const [{ data: products, error: productsError }, { data: branches, error: branchesError }, { data: movements, error: movementsError }] = await Promise.all([
    supabase.from('dokkan_products').select('id, store_id, name, category, brand, status, created_at, dokkan_product_variants(id, sku, barcode, size, color, price, cost)').order('created_at', { ascending: true }),
    supabase.from('dokkan_branches').select('id, store_id, name, address, status').order('created_at', { ascending: true }),
    supabase.from('dokkan_inventory_movements').select('id, store_id, branch_id, product_variant_id, movement_type, quantity, created_at').order('created_at', { ascending: true }),
  ])
  if (productsError || branchesError || movementsError) throw new Error('Unable to load product inventory')
  return { products: products ?? [], branches: branches ?? [], movements: movements ?? [] }
}

export async function createDokkanStore(name: string, phone?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dokkan_create_store', { store_name: name, store_phone: phone ?? null })
  if (error) throw new Error('Unable to create store')
  return data as string
}

export async function createDokkanBranch(storeId: string, name: string, address?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dokkan_create_branch', { target_store_id: storeId, branch_name: name, branch_address: address ?? null })
  if (error) throw new Error('Unable to create branch')
  return data as string
}

export async function recordDokkanExpense(input: { storeId: string; branchId: string; title: string; category: string; amount: number; notes?: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dokkan_record_expense', { target_store_id: input.storeId, target_branch_id: input.branchId, expense_title: input.title, expense_category: input.category, expense_amount: input.amount, expense_notes: input.notes ?? null })
  if (error) throw new Error('Unable to record expense')
  return data as string
}

export async function getCurrentMemberContext() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Unauthenticated')
  const { data: members, error } = await supabase.from('dokkan_members').select('store_id, display_name, role, status, dokkan_stores(name)').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: true })
  if (error) throw new Error('Unable to load membership')
  const member = members?.[0]
  const store = Array.isArray(member?.dokkan_stores) ? member?.dokkan_stores[0] : member?.dokkan_stores
  return { user, member: member ?? null, storeName: store?.name ?? null, storeIds: (members ?? []).map((item) => item.store_id) }
}

export async function getDashboardData() {
  const supabase = await createClient()
  const context = await getCurrentMemberContext()
  const storeId = context.member?.store_id
  if (!storeId) return { displayName: context.user.user_metadata?.display_name ?? context.user.email ?? null, role: null, storeName: null, salesTotal: 0, salesCount: 0, expensesTotal: 0, inventoryUnits: 0, lowStockCount: 0, salesByDay: [], topProducts: [] }
  const [{ data: sales }, { data: expenses }, { data: movements }] = await Promise.all([
    supabase.from('dokkan_sales').select('id, total, created_at, dokkan_sale_items(quantity, unit_price, discount, dokkan_product_variants(dokkan_products(name)))').eq('store_id', storeId),
    supabase.from('dokkan_expenses').select('amount').eq('store_id', storeId),
    supabase.from('dokkan_inventory_movements').select('movement_type, quantity, product_variant_id, branch_id, created_at').eq('store_id', storeId),
  ])
  const saleRows = sales ?? []
  const movementRows = movements ?? []
  const inventory = new Map<string, number>()
  for (const movement of movementRows) { const sign = ['opening', 'purchase', 'return', 'adjustment', 'transfer_in'].includes(movement.movement_type) ? 1 : -1; const key = `${movement.branch_id}:${movement.product_variant_id}`; inventory.set(key, (inventory.get(key) ?? 0) + sign * movement.quantity) }
  const productUnits = new Map<string, { name: string; quantity: number; total: number }>()
  for (const sale of saleRows) for (const item of sale.dokkan_sale_items ?? []) { const variant = Array.isArray(item.dokkan_product_variants) ? item.dokkan_product_variants[0] : item.dokkan_product_variants; const product = Array.isArray(variant?.dokkan_products) ? variant?.dokkan_products[0] : variant?.dokkan_products; const name = product?.name ?? 'منتج'; const current = productUnits.get(name) ?? { name, quantity: 0, total: 0 }; current.quantity += item.quantity; current.total += item.quantity * Number(item.unit_price) - Number(item.discount); productUnits.set(name, current) }
  const salesByDay = Array.from({ length: 7 }, (_, index) => { const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000); const key = date.toISOString().slice(0, 10); return { label: date.toLocaleDateString('ar-EG', { weekday: 'short', timeZone: 'Africa/Cairo' }), total: saleRows.filter((sale) => sale.created_at.slice(0, 10) === key).reduce((sum, sale) => sum + Number(sale.total), 0) } })
  return { displayName: context.member?.display_name || context.user.user_metadata?.display_name || context.user.email || null, role: context.member?.role ?? null, storeName: context.storeName, salesTotal: saleRows.reduce((sum, sale) => sum + Number(sale.total), 0), salesCount: saleRows.length, expensesTotal: (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0), inventoryUnits: Array.from(inventory.values()).reduce((sum, quantity) => sum + Math.max(quantity, 0), 0), lowStockCount: Array.from(inventory.values()).filter((quantity) => quantity > 0 && quantity < 5).length, salesByDay, topProducts: Array.from(productUnits.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5) }
}
