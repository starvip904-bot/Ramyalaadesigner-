'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createProductAction(input: { storeId: string; name: string; category: string; brand?: string; sku: string; barcode?: string; size?: string; color?: string; price: number; cost: number }) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dokkan_create_product', { target_store_id: input.storeId, product_name: input.name.trim(), product_category: input.category.trim(), product_brand: input.brand?.trim() || null, variant_sku: input.sku.trim(), variant_barcode: input.barcode?.trim() || null, variant_size: input.size?.trim() || null, variant_color: input.color?.trim() || null, variant_price: input.price, variant_cost: input.cost })
  if (error) throw new Error('Unable to create product')
  revalidatePath('/products'); return data as string
}

export async function updateProductAction(input: { id: string; name: string; category: string; brand?: string; status: 'active' | 'inactive' }) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dokkan_update_product', { target_product_id: input.id, product_name: input.name.trim(), product_category: input.category.trim(), product_brand: input.brand?.trim() || null, product_status: input.status })
  if (error) throw new Error('Unable to update product')
  revalidatePath('/products')
}

export async function recordInventoryMovementAction(input: { storeId: string; branchId: string; variantId: string; type: 'opening' | 'purchase' | 'sale' | 'return' | 'adjustment' | 'transfer_out' | 'transfer_in'; quantity: number }) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dokkan_record_inventory_movement', { target_store_id: input.storeId, target_branch_id: input.branchId, target_variant_id: input.variantId, movement: input.type, movement_quantity: input.quantity, target_reference_id: null })
  if (error) throw new Error(error.message.includes('insufficient') ? 'Insufficient stock' : 'Unable to record inventory movement')
  revalidatePath('/inventory'); revalidatePath('/products')
}
