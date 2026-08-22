import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env, hasSupabase } from '../env'

/**
 * Proxy (Next.js 16 — replaces middleware.ts).
 * Refreshes Supabase auth cookie on every request & enforces protected routes.
 *
 * Public routes: /, /rooms, /rooms/[id], /login, /register, /api/*
 * Protected routes: /bookings, /bookings/*, /account/*
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!hasSupabase) {
    return response
  }

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: Do not use getSession() here. Use getUser() which validates the JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/bookings', '/account', '/reception', '/housekeeper', '/manager']
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Staff-only routes (require reception/housekeeper/manager/admin role)
  const staffPaths = ['/reception', '/housekeeper', '/manager']
  const isStaffPath = staffPaths.some((p) => request.nextUrl.pathname.startsWith(p))
  if (user && isStaffPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role
    const path = request.nextUrl.pathname
    const isReceptionPath = path.startsWith('/reception')
    const isHousekeeperPath = path.startsWith('/housekeeper')
    const isManagerPath = path.startsWith('/manager')

    if (isReceptionPath && role !== 'reception' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
    if (isHousekeeperPath && role !== 'housekeeper' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
    if (isManagerPath && role !== 'manager' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Redirect authed users away from /login and /register
  const authPages = ['/login', '/register']
  if (user && authPages.includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
