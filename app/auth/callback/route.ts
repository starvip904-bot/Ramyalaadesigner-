
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getSafeNextUrl(next: string | null, origin: string) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return null
  }

  try {
    const destination = new URL(next, origin)

    if (destination.origin !== origin) {
      return null
    }

    return destination
  } catch {
    return null
  }
}

function isValidEmployeeInvitation(url: URL) {
  if (url.pathname !== '/employee-invite/accept') {
    return false
  }

  const token = url.searchParams.get('token') || ''

  return /^[a-f0-9]{64}$/.test(token)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')
  const safeNext = getSafeNextUrl(next, url.origin)

  const supabase = await createClient()

  // Employee invitation flow.
  // Preserve the invitation-specific handling.
  if (safeNext && isValidEmployeeInvitation(safeNext)) {
    if (code) {
      const { error } =
        await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error(
          'Employee invitation code exchange failed:',
          error
        )

        const errorUrl = new URL(safeNext)
        errorUrl.searchParams.set('auth_error', 'callback')

        return NextResponse.redirect(errorUrl)
      }
    }

    return NextResponse.redirect(safeNext)
  }

  // Exchange the recovery code BEFORE redirecting to the
  // password reset page. Otherwise the reset page has no session.
  if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback code exchange failed:', error)

      if (safeNext?.pathname === '/reset-password') {
        return NextResponse.redirect(
          new URL('/forgot-password?error=callback', url.origin)
        )
      }

      return NextResponse.redirect(
        new URL('/login?error=callback', url.origin)
      )
    }
  }

  // Password recovery must reach this point only AFTER
  // the authorization code has been exchanged successfully.
  if (safeNext?.pathname === '/reset-password') {
    return NextResponse.redirect(safeNext)
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
