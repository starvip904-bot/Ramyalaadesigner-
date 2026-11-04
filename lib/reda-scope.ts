import 'server-only'

import { createClient } from '@/lib/supabase/server'

export const REDA_STORE_ID = '737055df-14f0-40c2-8e6a-98fc9e4f68e3' as const

export function assertRedaStoreId(storeId: string | null | undefined) {
  if (storeId !== REDA_STORE_ID) throw new Error('REDA_SCOPE_VIOLATION')
  return REDA_STORE_ID
}

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
  if (!store || store.id !== REDA_STORE_ID) throw new Error('REDA_SCOPE_VIOLATION')

  return { supabase, user, membership, storeId: REDA_STORE_ID, storeName: store.name }
}

export function requireRedaStoreId(candidate?: string | null) {
  return assertRedaStoreId(candidate ?? REDA_STORE_ID)
}
