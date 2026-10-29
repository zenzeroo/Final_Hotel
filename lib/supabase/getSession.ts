import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './server'
import { accessBlock, type UserRole } from './roles'

// roleHomePath + UserRole moved to ./roles (re-exported below for
// back-compat — 20+ server-side consumers import them from this file).
export { roleHomePath } from './roles'
export type { UserRole } from './roles'

export interface SessionUser {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  role: UserRole
  /** R2 object key for the user's avatar image, or null if not set. */
  avatarKey: string | null
  /** Saved UI language (`profiles.locale`), or null if never set. */
  locale: string | null
  /** Policy version the user accepted (`profiles.terms_version`), or null — see lib/consent.ts. */
  termsVersion: string | null
}

/**
 * Server-side session helper. Returns null if not authenticated.
 *
 * Phase 36 — also enforces customer suspension at app-layer:
 * if `profiles.is_suspended=true`, the user is signed out and redirected
 * to /login?error=suspended. Supabase auth itself doesn't read profiles,
 * so this JS-side check is the canonical guard.
 *
 * Wrapped in React `cache` so the root layout, route layouts, the page,
 * TopNavBar and `getLocale()` share ONE auth + profile lookup per render
 * instead of each paying the round trips again.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch profile (incl. suspension flag for the app-layer guard below).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, role, avatar_key, is_suspended, is_active, locale, terms_version')
    .eq('id', user.id)
    .maybeSingle()

  // Suspended customers and deactivated staff are signed out and sent to
  // /login with a banner code. signOut() revokes the session server-side;
  // a Server Component cannot clear cookies, so the proxy clears them when
  // the browser lands on /login (or this page would redirect to itself).
  // The DB side for staff is is_staff() / has_role(), which require
  // is_active (20261022).
  const block = accessBlock(profile)
  if (block) {
    await supabase.auth.signOut()
    redirect(`/login?error=${block}`)
  }

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    role: (profile?.role as UserRole) ?? 'user',
    avatarKey: profile?.avatar_key ?? null,
    locale: profile?.locale ?? null,
    termsVersion: profile?.terms_version ?? null,
  }
})

