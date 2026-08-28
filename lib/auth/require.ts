import { redirect } from 'next/navigation'
import { getSession, roleHomePath, type SessionUser, type UserRole } from '@/lib/supabase/getSession'

/**
 * Single helper for server-action role gates.
 *
 * Replaces the 11 inline `requireAdminRates` / `requireManager` / etc.
 * helpers that were duplicated across `app/actions/*.ts`. Centralizes
 * the two redirect rules so a future RBAC tweak (e.g. logging denied
 * attempts, or swapping the wrong-role target) only touches one file.
 *
 * Behavior:
 *   1. No session          → redirect('/login?next=<redirectPath>')
 *                             (or just '/login' if `redirectPath` is omitted)
 *   2. Wrong role          → redirect(roleHomePath(session.role))
 *                             (staff never lands on `/` — see `roleHomePath`)
 *   3. Otherwise           → return the SessionUser so the caller can
 *                             read `session.id`, `session.role`, etc.
 *
 * @example
 *   const session = await requireRole('admin', '/admin/rates')
 *   const session = await requireRole(['manager', 'admin'], '/manager')
 *   const session = await requireRole(['user', 'admin', 'reception',
 *                                      'housekeeper', 'manager']) // any auth
 */
export async function requireRole(
  allowed: UserRole | readonly UserRole[],
  redirectPath?: string,
): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    if (redirectPath) {
      redirect(`/login?next=${encodeURIComponent(redirectPath)}`)
    } else {
      redirect('/login')
    }
  }
  const roles = Array.isArray(allowed) ? allowed : [allowed]
  if (!roles.includes(session.role)) redirect(roleHomePath(session.role))
  return session
}
