import { createClient } from './server'

export type UserRole = 'user' | 'reception' | 'housekeeper' | 'manager' | 'admin'

export interface SessionUser {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  role: UserRole
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
    .select('full_name, phone, role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    role: (profile?.role as UserRole) ?? 'user',
  }
}

