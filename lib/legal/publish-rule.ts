import { LEGAL_DOCS, type LegalDoc, type LegalKeys } from './docs'

/**
 * Phase 62 — whether the admin can publish the draft. Same rule (and error
 * codes) as the `publish_legal_version()` RPC, which is the one that
 * enforces it; this copy only drives the admin UI.
 *  - the draft must hold at least one new file
 *  - every doc must have a file, from the draft or from the current version
 */
export function canPublish(
  draft: LegalKeys,
  current: LegalKeys | null,
):
  | { ok: true; merged: Record<LegalDoc, string> }
  | { ok: false; reason: 'NOTHING_TO_PUBLISH' | 'INCOMPLETE'; missing?: LegalDoc[] } {
  if (LEGAL_DOCS.every((d) => !draft[d])) return { ok: false, reason: 'NOTHING_TO_PUBLISH' }
  const missing = LEGAL_DOCS.filter((d) => !(draft[d] ?? current?.[d]))
  if (missing.length > 0) return { ok: false, reason: 'INCOMPLETE', missing }
  const merged = Object.fromEntries(
    LEGAL_DOCS.map((d) => [d, (draft[d] ?? current?.[d]) as string]),
  ) as Record<LegalDoc, string>
  return { ok: true, merged }
}
