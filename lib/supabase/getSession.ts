import { redirect } from 'next/navigation'
import { createClient } from './server'
import { roleHomePath, type UserRole } from './roles'

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
}

/**
 * Server-side session helper. Returns null if not authenticated.
 *
 * Phase 36 — also enforces customer suspension at app-layer:
 * if `profiles.is_suspended=true`, the user is signed out and redirected
 * to /login?error=suspended. Supabase auth itself doesn't read profiles,
 * so this JS-side check is the canonical guard.
 */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch profile (incl. suspension flag for the app-layer guard below).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, role, avatar_key, is_suspended')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_suspended) {
    // Sign out so the cookie is cleared — next request can't re-trigger
    // this branch. Redirect to /login with a query param the login page
    // can surface as a red banner.
    await supabase.auth.signOut()
    redirect('/login?error=suspended')
  }

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    role: (profile?.role as UserRole) ?? 'user',
    avatarKey: profile?.avatar_key ?? null,
  }
}

