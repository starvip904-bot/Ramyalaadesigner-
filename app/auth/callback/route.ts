
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback exchange failed:', error)

      return NextResponse.redirect(
        new URL('/login?error=callback', url.origin)
      )
    }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(
      new URL('/login?error=authentication', url.origin)
    )
  }

  // Handle password recovery before normal owner/store routing.
  if (next === '/reset-password') {
    return NextResponse.redirect(
      new URL('/reset-password', url.origin)
    )
  }

  const { data: owner, error: ownerError } = await supabase.rpc(
    'dokkan_is_platform_owner'
  )

  if (ownerError) {
    console.error('Platform owner check failed:', ownerError)
  }

  if (owner === true) {
    return NextResponse.redirect(
      new URL('/platform', url.origin)
    )
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from('dokkan_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    console.error(
      'Dokkan membership lookup failed:',
      membershipError
    )

    return NextResponse.redirect(
      new URL('/login?error=membership', url.origin)
    )
  }

  if (!membership) {
    return NextResponse.redirect(
      new URL('/onboarding/store', url.origin)
    )
  }

  return NextResponse.redirect(
    new URL('/dashboard', url.origin)
  )
}
