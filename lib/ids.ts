/**
 * Shared UUID helpers. Mirrors the regex used by Zod's `.uuid()` so
 * server-side checks line up with validation performed at the form
 * boundary.
 */

/** Standard 8-4-4-4-12 hex UUID, case-insensitive. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Type guard: true iff `v` is a string that matches `UUID_RE`. */
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}
