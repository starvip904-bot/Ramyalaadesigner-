'use server'

import { getInventoryCountDetails } from '@/lib/inventory-counts-repository'

export async function getInventoryCountDetailsAction(countId: string) {
  if (!countId?.trim()) {
    throw new Error('يجب تحديد الجرد.')
  }

  return getInventoryCountDetails(countId)
}