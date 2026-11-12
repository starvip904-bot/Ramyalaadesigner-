
'use server'

import { randomInt, randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import {
  requireRedaBranch,
  requireRedaContext,
} from '@/lib/reda-scope'

async function getAuthorizedStore(storeId: string) {
  const context = await requireRedaContext()

  if (!storeId || storeId !== context.storeId) {
    throw new Error('STORE_ACCESS_DENIED')
  }

  return context
}

function generateVariantSku() {
  return `SKU-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
}

// إنشاء باركود EAN-13 للاستخدام الداخلي
function generateVariantBarcode() {
  const body = `20${randomInt(0, 10_000_000_000)
    .toString()
    .padStart(10, '0')}`

  let sum = 0

  for (let index = 0; index < body.length; index++) {
    sum += Number(body[index]) * (index % 2 === 0 ? 1 : 3)
  }

  const checkDigit = (10 - (sum % 10)) % 10

  return `${body}${checkDigit}`
}

export async function createProductAction(input: {
  storeId: string
  name: string
  category: string
  brand?: string
  sku: string
  barcode?: string
  size?: string
  color?: string
  price: number
  cost: number
}) {
  const context = await getAuthorizedStore(input.storeId)

  const sku = input.sku.trim() || generateVariantSku()
  const barcode =
    input.barcode?.trim() || generateVariantBarcode()

  const { data, error } = await context.supabase.rpc(
    'dokkan_create_product',
    {
      target_store_id: context.storeId,
      product_name: input.name.trim(),
      product_category: input.category.trim(),
      product_brand: input.brand?.trim() || null,
      variant_sku: sku,
      variant_barcode: barcode,
      variant_size: input.size?.trim() || null,
      variant_color: input.color?.trim() || null,
      variant_price: input.price,
      variant_cost: input.cost,
    }
  )

  if (error) {
    if (error.code === '23505') {
      throw new Error('كود SKU أو الباركود مستخدم بالفعل. حاول مرة أخرى.')
    }

    throw new Error(error.message)
  }

  revalidatePath('/products')
  revalidatePath('/inventory')

  return data as string
}

export type ProductVariantInput = {
  sku: string
  barcode?: string
  size?: string
  color?: string
  price: number
  cost: number
}

export async function createProductWithVariantsAction(input: {
  storeId: string
  name: string
  category: string
  brand?: string
  variants: ProductVariantInput[]
}) {
  const context = await getAuthorizedStore(input.storeId)

  if (
    !input.name.trim() ||
    !input.category.trim() ||
    !Array.isArray(input.variants) ||
    input.variants.length === 0 ||
    input.variants.length > 200
  ) {
    throw new Error('بيانات المنتج أو المتغيرات غير مكتملة.')
  }

  const variants = input.variants.map((variant) => {
    const price = Number(variant.price)
    const cost = Number(variant.cost)

    if (
      !Number.isFinite(price) ||
      !Number.isFinite(cost) ||
      price < 0 ||
      cost < 0
    ) {
      throw new Error('راجع سعر البيع والتكلفة لكل متغير.')
    }

    return {
      sku: variant.sku.trim() || generateVariantSku(),
      barcode:
        variant.barcode?.trim() || generateVariantBarcode(),
      size: variant.size?.trim() || null,
      color: variant.color?.trim() || null,
      price,
      cost,
    }
  })

  const { data, error } = await context.supabase.rpc(
    'dokkan_create_product_with_variants',
    {
      target_store_id: context.storeId,
      product_name: input.name.trim(),
      product_category: input.category.trim(),
      product_brand: input.brand?.trim() || null,
      variants,
    }
  )

  if (error) {
    if (error.code === '23505') {
      throw new Error('يوجد SKU أو باركود مكرر. حاول الحفظ مرة أخرى.')
    }

    throw new Error(error.message)
  }

  revalidatePath('/products')
  revalidatePath('/inventory')

  return data as string
}

export async function updateProductVariantAction(
  input: { id: string } & ProductVariantInput
) {
  const context = await requireRedaContext()

  const { error } = await context.supabase.rpc(
    'dokkan_update_product_variant',
    {
      target_variant_id: input.id,
      variant_sku: input.sku.trim() || generateVariantSku(),
      variant_barcode:
        input.barcode?.trim() || generateVariantBarcode(),
      variant_size: input.size?.trim() || null,
      variant_color: input.color?.trim() || null,
      variant_price: input.price,
      variant_cost: input.cost,
    }
  )

  if (error) {
    if (error.code === '23505') {
      throw new Error('كود SKU أو الباركود مستخدم بالفعل.')
    }

    throw new Error(error.message)
  }

  revalidatePath('/products')
  revalidatePath('/inventory')
}

export async function updateProductAction(input: {
  id: string
  name: string
  category: string
  brand?: string
  status: 'active' | 'inactive'
}) {
  const context = await requireRedaContext()

  const { error } = await context.supabase.rpc(
    'dokkan_update_product',
    {
      target_product_id: input.id,
      product_name: input.name.trim(),
      product_category: input.category.trim(),
      product_brand: input.brand?.trim() || null,
      product_status: input.status,
    }
  )

  if (error) throw new Error('Unable to update product')

  revalidatePath('/products')
}

export async function recordInventoryMovementAction(input: {
  storeId: string
  branchId: string
  variantId: string
  type: 'opening' | 'adjustment'
  quantity: number
}) {
  const context = await getAuthorizedStore(input.storeId)

  await requireRedaBranch(input.branchId)

  if (
    !Number.isFinite(input.quantity) ||
    input.quantity === 0 ||
    (input.type === 'opening' && input.quantity < 0)
  ) {
    throw new Error('INVALID_INVENTORY_QUANTITY')
  }

  const { error } = await context.supabase.rpc(
    'dokkan_record_inventory_movement',
    {
      target_store_id: context.storeId,
      target_branch_id: input.branchId,
      target_variant_id: input.variantId,
      movement: input.type,
      movement_quantity: input.quantity,
      target_reference_id: null,
    }
  )

  if (error) {
    throw new Error(
      error.message.includes('insufficient')
        ? 'Insufficient stock'
        : 'Unable to record inventory movement'
    )
  }

  revalidatePath('/inventory')
  revalidatePath('/products')
}
