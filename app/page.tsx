import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMemberContext } from '@/lib/dokkan-repository'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: isPlatformOwner } = await supabase.rpc('dokkan_is_platform_owner')
  if (isPlatformOwner === true) redirect('/platform')

  const context = await getCurrentMemberContext()
  if (!context.member) redirect('/onboarding/store')
  redirect('/dashboard')
}
