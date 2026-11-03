import { createClient } from '@/lib/supabase/server'

export async function requireAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('UNAUTHENTICATED')
  return { supabase, user }
}

export async function getTenantContext() {
  const { supabase, user } = await requireAuthenticatedUser()
  const { data: memberships, error } = await supabase.from('dokkan_members').select('store_id, role, display_name, status, dokkan_stores(id, name, status)').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: true })
  if (error) throw new Error('MEMBERSHIP_LOOKUP_FAILED')
  return { supabase, user, memberships: memberships ?? [] }
}

export async function requireStoreMembership(storeId: string, roles?: string[]) {
  const context = await getTenantContext()
  const membership = context.memberships.find((item) => item.store_id === storeId)
  if (!membership || (roles?.length && !roles.includes(membership.role))) throw new Error('STORE_ACCESS_DENIED')
  return { ...context, membership }
}

export async function requirePlatformOwner() {
  const { supabase, user } = await requireAuthenticatedUser()
  const { data, error } = await supabase.rpc('dokkan_is_platform_owner')
  if (error || data !== true) throw new Error('PLATFORM_ACCESS_DENIED')
  return { supabase, user }
}
