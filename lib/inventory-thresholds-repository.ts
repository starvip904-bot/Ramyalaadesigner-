
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function listInventoryAlertThresholds() {
  const context = await requireRedaContext()

  const { data, error } = await context.supabase
    .from('dokkan_inventory_alert_thresholds')
    .select(
      'id, store_id, branch_id, product_variant_id, minimum_quantity'
    )
    .eq('store_id', context.storeId)

  if (error) {
    console.error('[InventoryThresholds] Load failed:', error)
    throw new Error('تعذر تحميل حدود تنبيه المخزون.')
  }

  return data ?? []
}
