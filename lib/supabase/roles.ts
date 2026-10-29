/**
 * Role → home-path mapping. Pure module — no Supabase client, no
 * `next/headers`, no server-only imports. Safe to use in BOTH Server
 * Components and Client Components.
 *
 * Extracted from `lib/supabase/getSession.ts` so the StaffSidebar
 * client bundle doesn't drag `next/headers` (used by `server.ts` →
 * `getSession.ts`) into the browser. StaffSidebar is `'use client'`
 * and previously imported `roleHomePath` from `getSession`, which
 * Next.js rejected at bundle time with "You're importing a module
 * that depends on next/headers ... you are using it in the Pages
 * Router."
 */
export type UserRole = 'user' | 'reception' | 'housekeeper' | 'manager' | 'admin'

/**
 * Single source of truth for role → home-path mapping. Used by every
 * wrong-role redirect in the codebase (proxy.ts, layouts, server actions).
 *
 * Phase 11: staff must never land on `/` (User homepage) — they go to
 * their own dashboard instead. If you add a new role, update this AND
 * add the route to proxy.ts `staffPaths` (or a role-specific layout).
 */
/**
 * Why a signed-in account may not use the app, or null. Customers are
 * suspended (`is_suspended`); staff are deactivated by an admin
 * (`is_active=false`, which customers never use). The value is also the
 * `/login?error=` code. Checked by getSession() and by the proxy, which is
 * the only place that can clear the auth cookies on a page request.
 */
export function accessBlock(
  profile: { role: string; is_suspended?: boolean | null; is_active?: boolean | null } | null,
): 'suspended' | 'deactivated' | null {
  if (!profile) return null
  if (profile.is_suspended) return 'suspended'
  if (profile.role !== 'user' && profile.is_active === false) return 'deactivated'
  return null
}

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
