import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRedaContext } from '@/lib/reda-scope'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireRedaContext()
  redirect('/dashboard')
}
