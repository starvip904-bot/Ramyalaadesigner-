import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_STORAGE_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_STORAGE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STORAGE_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll(values) { values.forEach(({ name, value, options }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  const isPublic = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/sign-up' || request.nextUrl.pathname.startsWith('/auth/') || request.nextUrl.pathname.startsWith('/_next/')
  if (!user && !isPublic) return NextResponse.redirect(new URL('/login', request.url))
  if (user && request.nextUrl.pathname === '/login') return NextResponse.redirect(new URL('/dashboard', request.url))
  return response
}
