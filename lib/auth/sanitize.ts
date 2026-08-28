/**
 * Shared helpers for the OAuth callback route + signInWithGoogle server
 * action. Lives outside `app/actions/auth.ts` so both the `'use server'`
 * action and the non-action route handler can import it without violating
 * the "all exports must be async actions" rule that `'use server'` files
 * impose.
 */

/**
 * Guard against open-redirect via a crafted `?next=` value.
 *
 * Allowed: same-origin absolute paths (`/`, `/bookings/abc`, `/?x=1`)
 * Rejected: empty string, protocol-relative (`//evil.com`),
 *           backslash-prefix (`/\\evil.com`), or anything not starting with `/`
 *
 * Used by both the OAuth callback route and `signInWithGoogle` action so
 * the validation logic stays in lock-step — the two share a single source
 * of truth.
 */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') return '/'
  // Must be an absolute path, and must NOT escape via `//` or `/\`.
  if (!next.startsWith('/')) return '/'
  if (next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}
