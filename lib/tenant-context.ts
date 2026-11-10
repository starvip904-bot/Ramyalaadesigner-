
import 'server-only'

import { createClient } from '@/lib/supabase/server'

export async function requireAuthenticatedUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('UNAUTHENTICATED')
  }

  return { supabase, user }
}

export async function getTenantContext() {
  const { supabase, user } = await requireAuthenticatedUser()

  const { data: memberships, error } = await supabase
    .from('dokkan_members')
    .select(`
      id,
      store_id,
      role,
      display_name,
      status,
      dokkan_stores (
        id,
        name,
        status
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error('MEMBERSHIP_LOOKUP_FAILED')
  }

  return {
    supabase,
    user,
    memberships: memberships ?? [],
  }
}

function getRelatedStore(membership: any) {
  const related = membership.dokkan_stores

  return Array.isArray(related)
    ? related[0] ?? null
    : related ?? null
}

export async function requireCurrentStoreContext(roles?: string[]) {
  const context = await getTenantContext()

  if (context.memberships.length === 0) {
    throw new Error('STORE_MEMBERSHIP_REQUIRED')
  }

  if (context.memberships.length > 1) {
    throw new Error('MULTIPLE_ACTIVE_STORE_MEMBERSHIPS')
  }

  const membership = context.memberships[0]
  const store = getRelatedStore(membership)

  if (!store || store.status !== 'active') {
    throw new Error('STORE_NOT_ACTIVE')
  }

  if (roles?.length && !roles.includes(membership.role)) {
    throw new Error('STORE_ROLE_DENIED')
  }

  return {
    ...context,
    membership,
    store,
    storeId: membership.store_id,
    storeName: store.name,
  }
}

export async function requireStoreMembership(
  storeId: string,
  roles?: string[]
) {
  if (!storeId) {
    throw new Error('STORE_ID_REQUIRED')
  }

  const context = await getTenantContext()

  const membership = context.memberships.find(
    (item) => item.store_id === storeId
  )

  if (!membership) {
    throw new Error('STORE_ACCESS_DENIED')
  }

  const store = getRelatedStore(membership)

  if (!store || store.status !== 'active') {
    throw new Error('STORE_NOT_ACTIVE')
  }

  if (roles?.length && !roles.includes(membership.role)) {
    throw new Error('STORE_ROLE_DENIED')
  }

  return {
    ...context,
    membership,
    store,
    storeId: membership.store_id,
    storeName: store.name,
  }
}

export async function requirePlatformOwner() {
  const { supabase, user } = await requireAuthenticatedUser()

  const { data, error } = await supabase.rpc(
    'dokkan_is_platform_owner'
  )

  if (error || data !== true) {
    throw new Error('PLATFORM_ACCESS_DENIED')
  }

  return { supabase, user }
}
