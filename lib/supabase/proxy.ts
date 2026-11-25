
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
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
          values.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          response = NextResponse.next({ request })

          values.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  let user: User | null = null

  try {
    const { data, error } = await supabase.auth.getUser()

    if (!error) {
      user = data.user
    }
  } catch {
    console.error('Supabase session check failed')
  }

  const pathname = request.nextUrl.pathname

  const publicExactPaths = [
    '/',
    '/login',
    '/register',
    '/sign-up',
    '/forgot-password',
    '/pricing',
    '/reset-password',
    '/employee-invite/accept',
  ]

  const isPublic =
    publicExactPaths.includes(pathname) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (
    user &&
    ['/login', '/register', '/sign-up'].includes(pathname)
  ) {
    return NextResponse.redirect(new URL('/auth/callback', request.url))
  }

  return response
}
