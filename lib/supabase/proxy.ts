
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_STORAGE_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_STORAGE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_STORAGE_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(values) {
          values.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          response = NextResponse.next({ request })

          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isPublic =
    pathname === '/' ||
    ['/login', '/register', '/sign-up', '/forgot-password', '/pricing'].includes(pathname) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/')

  if (!user && !isPublic && pathname !== '/reset-password') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && ['/login', '/register', '/sign-up'].includes(pathname)) {
    return NextResponse.redirect(new URL('/auth/callback', request.url))
  }

  return response
}
