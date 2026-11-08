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
  const isPublic = ['/login', '/register', '/sign-up', '/forgot-password', '/pricing'].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/auth/') || request.nextUrl.pathname.startsWith('/_next/')
  if (!user && !isPublic && request.nextUrl.pathname !== '/reset-password') return NextResponse.redirect(new URL('/login', request.url))
  if (user && ['/login', '/register', '/sign-up'].includes(request.nextUrl.pathname)) return NextResponse.redirect(new URL('/auth/callback', request.url))

return response
} 
