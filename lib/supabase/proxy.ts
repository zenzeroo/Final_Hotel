import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env, hasSupabase } from '../env'
import { roleHomePath, type UserRole } from './getSession'
import { accessBlock } from './roles'
import { consentVersionOf, needsConsent } from '../consent'
import { fetchCurrentLegalVersion } from '../legal/current'

/**
 * Proxy (Next.js 16 — replaces middleware.ts).
 * Refreshes Supabase auth cookie on every request & enforces protected routes.
 *
 * Public routes: /, /rooms, /rooms/[id], /bookings, /bookings/*, /login, /register, /api/*
 * Protected routes: /account, /account/*, /reception/*, /housekeeper/*, /manager/*, /admin/*
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

  // getUser() may have refreshed the session and written new auth cookies
  // onto `response`; a redirect must carry them, or the browser keeps the
  // old (now revoked) refresh token and is signed out on its next request.
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  // Protected routes. /bookings is intentionally NOT here — logged-out
  // visitors see a styled "please sign in" placeholder card on the page
  // itself (app/(booking)/bookings/page.tsx) instead of being auto-
  // redirected. The (booking) layout still keeps staff out via a
  // role check. Every other customer-only path still redirects.
  const protectedPaths = ['/account', '/reception', '/housekeeper', '/manager', '/admin']
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return redirectTo(url)
  }

  // Staff-only routes (require reception/housekeeper/manager/admin role).
  // /admin is included so authenticated non-admin users can't slip past the role check.
  const staffPaths = ['/reception', '/housekeeper', '/manager', '/admin']
  const isStaffPath = staffPaths.some((p) => request.nextUrl.pathname.startsWith(p))
  if (user && isStaffPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = (profile?.role as UserRole | undefined) ?? 'user'
    const path = request.nextUrl.pathname
    const isReceptionPath = path.startsWith('/reception')
    const isHousekeeperPath = path.startsWith('/housekeeper')
    const isManagerPath = path.startsWith('/manager')
    const isAdminPath = path.startsWith('/admin')

    // Phase 11: wrong-role staff redirect to THEIR OWN dashboard, not '/'.
    if (isReceptionPath && role !== 'reception' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = roleHomePath(role)
      url.search = ''
      return redirectTo(url)
    }
    if (isHousekeeperPath && role !== 'housekeeper' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = roleHomePath(role)
      url.search = ''
      return redirectTo(url)
    }
    if (isManagerPath && role !== 'manager' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = roleHomePath(role)
      url.search = ''
      return redirectTo(url)
    }
    if (isAdminPath && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = roleHomePath(role)
      url.search = ''
      return redirectTo(url)
    }
  }

  // Phase 27 — staff landing on `/` should be redirected to their own
  // dashboard, not the User homepage. (Phase 11 docs say staff must
  // never land on `/` but only the wrong-role branches above were
  // implemented; this closes the gap for the homepage itself.)
  if (user && request.nextUrl.pathname === '/') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = (profile?.role as UserRole | undefined) ?? 'user'
    if (role !== 'user') {
      const url = request.nextUrl.clone()
      url.pathname = roleHomePath(role)
      url.search = ''
      return redirectTo(url)
    }
  }

  // Phase 61 — PDPA: a customer who has not accepted the current terms +
  // privacy notice (Google sign-ups, members from before consent existed,
  // everyone after a version bump) goes to /consent first, then back to the
  // exact page. GET only: server-action POSTs to these paths are refused by
  // the actions themselves (a redirect would break the action call).
  const consentPaths = ['/bookings', '/account']
  if (
    user &&
    request.method === 'GET' &&
    consentPaths.some((p) => request.nextUrl.pathname.startsWith(p))
  ) {
    // Phase 62 — the current version comes from legal_versions (newest
    // admin publish); only these gated GETs pay for the extra query.
    const [{ data: profile }, current] = await Promise.all([
      supabase.from('profiles').select('role, terms_version').eq('id', user.id).maybeSingle(),
      fetchCurrentLegalVersion(supabase),
    ])
    const role = (profile?.role as UserRole | undefined) ?? 'user'
    if (
      needsConsent({ role, termsVersion: profile?.terms_version ?? null }, consentVersionOf(current))
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/consent'
      url.search = ''
      url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
      return redirectTo(url)
    }
  }

  // Redirect authed users away from /login and /register to their role home.
  // Phase 11: staff now land on their dashboard, not '/'.
  const authPages = ['/login', '/register']
  if (user && authPages.includes(request.nextUrl.pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_suspended, is_active')
      .eq('id', user.id)
      .maybeSingle()

    // getSession() sends suspended / deactivated accounts here but cannot
    // clear the cookies from a Server Component; do it on this response,
    // otherwise /login sees the same user again and redirects to itself.
    const block = accessBlock(profile)
    if (block) {
      await supabase.auth.signOut()
      if (request.nextUrl.pathname === '/login' && request.nextUrl.searchParams.get('error') === block) {
        return response
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('error', block)
      return redirectTo(url)
    }

    const role = (profile?.role as UserRole | undefined) ?? 'user'
    const url = request.nextUrl.clone()
    url.pathname = roleHomePath(role)
    url.search = ''
    return redirectTo(url)
  }

  return response
}
