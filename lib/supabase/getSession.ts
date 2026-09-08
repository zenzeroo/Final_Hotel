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

