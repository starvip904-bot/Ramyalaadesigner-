
'use server'

import { revalidatePath } from 'next/cache'
import {
  requireRedaBranch,
  requireRedaContext,
} from '@/lib/reda-scope'

export async function saveInventoryAlertThresholdAction(input: {
  storeId: string
  branchId: string
  variantId: string
  minimumQuantity: number
}) {
  const context = await requireRedaContext(['owner', 'admin'])

  if (!input.storeId || input.storeId !== context.storeId) {
    throw new Error('STORE_ACCESS_DENIED')
  }

  if (
    !input.branchId ||
    !input.variantId ||
    !Number.isInteger(input.minimumQuantity) ||
    input.minimumQuantity < 0
  ) {
    throw new Error('راجع بيانات حد تنبيه المخزون.')
  }

  await requireRedaBranch(input.branchId)

  const { error } = await context.supabase
    .from('dokkan_inventory_alert_thresholds')
    .upsert(
      {
        store_id: context.storeId,
        branch_id: input.branchId,
        product_variant_id: input.variantId,
        minimum_quantity: input.minimumQuantity,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'branch_id,product_variant_id',
      }
    )

  if (error) {
    console.error('[InventoryThreshold] Save failed:', error)
    throw new Error('تعذر حفظ حد تنبيه المخزون.')
  }

  revalidatePath('/inventory')
  revalidatePath('/products')
  revalidatePath('/dashboard')
}
