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
