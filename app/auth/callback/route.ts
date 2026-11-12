
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
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
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  const { data: owner } = await supabase.rpc(
    'dokkan_is_platform_owner'
  )

  if (owner === true) {
    return NextResponse.redirect(new URL('/platform', url.origin))
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from('dokkan_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

  if (membershipError) {
    console.error('Dokkan membership lookup failed:', membershipError)

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
