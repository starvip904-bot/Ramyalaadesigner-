import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const allowedNext = new Set(['/dashboard', '/onboarding/store', '/reset-password'])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const requestedNext = url.searchParams.get('next') || '/dashboard'
  const next = allowedNext.has(requestedNext) ? requestedNext : '/dashboard'
  const supabase = await createClient()
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL(`/login?error=callback`, url.origin))
  }
  if (next === '/reset-password') return NextResponse.redirect(new URL(next, url.origin))
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', url.origin))
  const { data: owner } = await supabase.rpc('dokkan_is_platform_owner')
  if (owner === true) return NextResponse.redirect(new URL('/platform', url.origin))
  const { data: membership } = await supabase.from('dokkan_members').select('id').eq('user_id', user.id).limit(1).maybeSingle()
  return NextResponse.redirect(new URL(membership ? '/dashboard' : '/onboarding/store', url.origin))
}
