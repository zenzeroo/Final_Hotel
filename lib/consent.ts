/**
 * Phase 61 — PDPA consent.
 *
 * PRIVACY_POLICY_VERSION is the single source for "which version of the
 * terms + privacy notice is current". /privacy shows it as the last-updated
 * date, and a customer whose profiles.terms_version differs is sent to
 * /consent (lib/supabase/proxy.ts) and refused by the booking actions until
 * they accept. Bump it whenever the wording of /terms or /privacy changes —
 * everyone is asked again.
 *
 * Plain module (no Next.js imports) so the proxy can use it too.
 */
import type { UserRole } from '@/lib/supabase/roles'

export const PRIVACY_POLICY_VERSION = '2026-10-23'

/** Staff are not gated: their data is processed under employment, not sign-up. */
export function needsConsent(session: { role: UserRole; termsVersion: string | null }): boolean {
  return session.role === 'user' && session.termsVersion !== PRIVACY_POLICY_VERSION
}
