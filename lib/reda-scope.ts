import 'server-only'

import {
  requireCurrentStoreContext,
} from '@/lib/tenant-context'

export async function requireRedaContext(roles?: string[]) {
  return requireCurrentStoreContext(roles)
}

export async function requireRedaBranch(
  branchId: string,
  options?: { activeOnly?: boolean }
) {
  if (!branchId) {
    throw new Error('BRANCH_ID_REQUIRED')
  }

  const context = await requireRedaContext()

  let query = context.supabase
    .from('dokkan_branches')
    .select('id, store_id, status')
    .eq('id', branchId)
    .eq('store_id', context.storeId)

  if (options?.activeOnly !== false) {
    query = query.eq('status', 'active')
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new Error('BRANCH_LOOKUP_FAILED')
  }

  if (!data) {
    throw new Error('BRANCH_ACCESS_DENIED')
  }

  return data
}

export async function requireRedaPurchase(purchaseId: string) {
  if (!purchaseId) {
    throw new Error('PURCHASE_ID_REQUIRED')
  }

  const context = await requireRedaContext()

  const { data, error } = await context.supabase
    .from('dokkan_purchases')
    .select('id, store_id')
    .eq('id', purchaseId)
    .eq('store_id', context.storeId)
    .maybeSingle()

  if (error) {
    throw new Error('PURCHASE_LOOKUP_FAILED')
  }

  if (!data) {
    throw new Error('PURCHASE_ACCESS_DENIED')
  }

  return data
}