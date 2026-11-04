'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaBranch, requireRedaContext } from '@/lib/reda-scope'

export async function createProductAction(input: { storeId: string; name: string; category: string; brand?: string; sku: string; barcode?: string; size?: string; color?: string; price: number; cost: number }) {
  const { supabase, storeId } = await requireRedaContext()
  const { data, error } = await supabase.rpc('dokkan_create_product', { target_store_id: storeId, product_name: input.name.trim(), product_category: input.category.trim(), product_brand: input.brand?.trim() || null, variant_sku: input.sku.trim(), variant_barcode: input.barcode?.trim() || null, variant_size: input.size?.trim() || null, variant_color: input.color?.trim() || null, variant_price: input.price, variant_cost: input.cost })
  if (error) throw new Error(error.message)
  revalidatePath('/products'); return data as string
}

export type ProductVariantInput = { sku: string; barcode?: string; size?: string; color?: string; price: number; cost: number }

export async function createProductWithVariantsAction(input: { storeId: string; name: string; category: string; brand?: string; variants: ProductVariantInput[] }) {
  const { supabase, storeId } = await requireRedaContext()
  const { data, error } = await supabase.rpc('dokkan_create_product_with_variants', { target_store_id: storeId, product_name: input.name.trim(), product_category: input.category.trim(), product_brand: input.brand?.trim() || null, variants: input.variants.map((variant) => ({ ...variant, sku: variant.sku.trim(), barcode: variant.barcode?.trim() || null, size: variant.size?.trim() || null, color: variant.color?.trim() || null })) })
  if (error) throw new Error(error.message)
  revalidatePath('/products'); revalidatePath('/inventory'); return data as string
}

export async function updateProductVariantAction(input: { id: string } & ProductVariantInput) {
  const { supabase } = await requireRedaContext()
  const { error } = await supabase.rpc('dokkan_update_product_variant', { target_variant_id: input.id, variant_sku: input.sku.trim(), variant_barcode: input.barcode?.trim() || null, variant_size: input.size?.trim() || null, variant_color: input.color?.trim() || null, variant_price: input.price, variant_cost: input.cost })
  if (error) throw new Error(error.message)
  revalidatePath('/products'); revalidatePath('/inventory')
}

export async function updateProductAction(input: { id: string; name: string; category: string; brand?: string; status: 'active' | 'inactive' }) {
  const { supabase } = await requireRedaContext()
  const { error } = await supabase.rpc('dokkan_update_product', { target_product_id: input.id, product_name: input.name.trim(), product_category: input.category.trim(), product_brand: input.brand?.trim() || null, product_status: input.status })
  if (error) throw new Error('Unable to update product')
  revalidatePath('/products')
}

export async function recordInventoryMovementAction(input: { storeId: string; branchId: string; variantId: string; type: 'opening' | 'purchase' | 'sale' | 'return' | 'adjustment' | 'transfer_out' | 'transfer_in'; quantity: number }) {
  const { supabase, storeId } = await requireRedaContext()
  await requireRedaBranch(input.branchId)
  const { error } = await supabase.rpc('dokkan_record_inventory_movement', { target_store_id: storeId, target_branch_id: input.branchId, target_variant_id: input.variantId, movement: input.type, movement_quantity: input.quantity, target_reference_id: null })
  if (error) throw new Error(error.message.includes('insufficient') ? 'Insufficient stock' : 'Unable to record inventory movement')
  revalidatePath('/inventory'); revalidatePath('/products')
}
