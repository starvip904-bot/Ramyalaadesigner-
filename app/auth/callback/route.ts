
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)

  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')

  const supabase = await createClient()

  // Exchange the recovery/login code for a Supabase session.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Supabase auth callback failed:', error)

      return NextResponse.redirect(
        new URL('/login?error=callback', url.origin)
      )
    }
  }

  // Allow only safe internal redirect paths.
  const safeNext =
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes('\\')
      ? next
      : null

  // Password recovery must reach the password reset page
  // before the normal platform-owner/store routing.
  if (safeNext === '/reset-password') {
    return NextResponse.redirect(
      new URL('/reset-password', url.origin)
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(
      new URL('/login', url.origin)
    )
  }

  // Check whether this user is the platform owner.
  const { data: owner, error: ownerError } =
    await supabase.rpc('dokkan_is_platform_owner')

  if (!ownerError && owner === true) {
    return NextResponse.redirect(
      new URL('/platform', url.origin)
    )
  }

  // Check active store membership.
  const { data: membership, error: membershipError } =
    await supabase
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
