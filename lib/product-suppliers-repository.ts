
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function listProductSuppliers(storeId: string) {
  const context = await requireRedaContext()

  if (!storeId || storeId !== context.storeId) {
    throw new Error('STORE_ACCESS_DENIED')
  }

  const { data, error } = await context.supabase
    .from('dokkan_suppliers')
    .select('id, name, phone')
    .eq('store_id', context.storeId)
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (error) {
    throw new Error('Unable to load product suppliers')
  }

  return data ?? []
}
