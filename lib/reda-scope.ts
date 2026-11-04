import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { assertRedaStoreId, REDA_STORE_ID, requireRedaStoreId } from '@/lib/reda-scope-guards'

export { assertRedaStoreId, REDA_STORE_ID, requireRedaStoreId }

export async function requireRedaContext(roles?: string[]) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('UNAUTHENTICATED')

  const { data: membership, error: membershipError } = await supabase
    .from('dokkan_members')
    .select('store_id, role, display_name, status, dokkan_stores(id, name, status)')
    .eq('store_id', REDA_STORE_ID)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (membershipError) throw new Error('REDA_MEMBERSHIP_LOOKUP_FAILED')
  if (!membership) throw new Error('REDA_ACCESS_DENIED')
  if (roles?.length && !roles.includes(membership.role)) throw new Error('REDA_ROLE_DENIED')

  const store = Array.isArray(membership.dokkan_stores) ? membership.dokkan_stores[0] : membership.dokkan_stores
  if (!store || store.id !== REDA_STORE_ID || store.status !== 'active') throw new Error('REDA_SCOPE_VIOLATION')

  return { supabase, user, membership, storeId: REDA_STORE_ID, storeName: store.name }
}

export async function requireRedaBranch(branchId: string, options?: { activeOnly?: boolean }) {
  const { supabase } = await requireRedaContext()
  let query = supabase
    .from('dokkan_branches')
    .select('id, store_id, status')
    .eq('id', branchId)
    .eq('store_id', REDA_STORE_ID)
  if (options?.activeOnly !== false) query = query.eq('status', 'active')
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error('REDA_BRANCH_LOOKUP_FAILED')
  if (!data) throw new Error('REDA_BRANCH_ACCESS_DENIED')
  return data
}

export async function requireRedaPurchase(purchaseId: string) {
  const { supabase } = await requireRedaContext()
  const { data, error } = await supabase
    .from('dokkan_purchases')
    .select('id, store_id')
    .eq('id', purchaseId)
    .eq('store_id', REDA_STORE_ID)
    .maybeSingle()
  if (error) throw new Error('REDA_PURCHASE_LOOKUP_FAILED')
  if (!data) throw new Error('REDA_PURCHASE_ACCESS_DENIED')
  return data
}
