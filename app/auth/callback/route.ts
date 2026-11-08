import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REDA_STORE_ID = '737055df-14f0-40c2-8e6a-98fc9e4f68e3'

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
  } = await supabase.auth.getUser()

  if (!user) {
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
      .eq('store_id', REDA_STORE_ID)
      .eq('status', 'active')
      .maybeSingle()

  if (membershipError) {
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