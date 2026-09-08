import { createClient } from './server'

export type UserRole = 'user' | 'reception' | 'housekeeper' | 'manager' | 'admin'

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
 * Single source of truth for role → home-path mapping. Used by every
 * wrong-role redirect in the codebase (proxy.ts, layouts, server actions).
 *
 * Phase 11: staff must never land on `/` (User homepage) — they go to
 * their own dashboard instead. If you add a new role, update this AND
 * add the route to proxy.ts `staffPaths` (or a role-specific layout).
 */
export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'manager':
      return '/manager'
    case 'reception':
      return '/reception'
    case 'housekeeper':
      return '/housekeeper'
    case 'user':
      return '/'
  }
}

/**
 * Server-side session helper. Returns null if not authenticated.
 */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, role, avatar_key')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    role: (profile?.role as UserRole) ?? 'user',
    avatarKey: profile?.avatar_key ?? null,
  }
}

