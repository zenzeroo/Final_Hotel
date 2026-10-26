/**
 * Phase 61 — PDPA consent.
 *
 * Phase 62 — the current consent version is the newest published
 * `legal_versions.version` (admin-uploaded PDFs, /admin/legal). Every publish
 * is a new version, so every customer is asked again. A customer whose
 * profiles.terms_version differs is sent to /consent (lib/supabase/proxy.ts)
 * and refused by the booking actions until they accept.
 *
 * PRIVACY_POLICY_VERSION is only the fallback while no version has been
 * published yet (the JSX /terms and /privacy pages are shown then). Bump it
 * only if that JSX wording changes before the first publish.
 *
 * Plain module (no Next.js imports) so the proxy can use it too.
 */
import type { UserRole } from '@/lib/supabase/roles'
import type { LegalVersionRow } from '@/lib/legal/current'

export const PRIVACY_POLICY_VERSION = '2026-10-23'

/** Consent version for the current published row (or the fallback). */
export function consentVersionOf(row: Pick<LegalVersionRow, 'version'> | null): string {
  return row?.version ?? PRIVACY_POLICY_VERSION
}

/** Staff are not gated: their data is processed under employment, not sign-up. */
export function needsConsent(
  session: { role: UserRole; termsVersion: string | null },
  currentVersion: string,
): boolean {
  return session.role === 'user' && session.termsVersion !== currentVersion
}
