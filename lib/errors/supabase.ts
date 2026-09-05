/**
 * Shared error helpers for the Supabase data layer + server actions.
 *
 * Two distinct concerns, one home:
 *
 * 1. `wrapSupabaseError(label, e)` — used inside `lib/data/supabase-*.ts`
 *    to throw a tagged error from inside PostgREST helpers. The `label`
 *    names the failing operation (e.g. 'createRoomType', 'listBookings')
 *    so server logs can trace which query blew up without parsing the
 *    message. Never returns; always throws.
 *
 * 2. `actionFail(e, fallback)` — used inside `app/actions/*.ts` catch
 *    blocks to convert a thrown error into the `{ ok: false, error }`
 *    branch of `ActionResult`. Surfaces the real error message when it's
 *    a normal `Error`, falls back to a Thai / English generic otherwise.
 */

/**
 * Wrap a thrown error with a `Supabase (label): …` prefix and re-throw.
 * Always throws (return type `never`) so call sites can write
 * `wrapSupabaseError('foo', error)` after the `if (error)` guard.
 *
 * Pass an empty string for `label` to keep the legacy un-prefixed
 * `Supabase: <msg>` format (used by data-layer helpers that don't yet
 * carry an operation name).
 *
 * Message extraction handles three shapes:
 *   1. `Error` instance — use `.message` directly (works for most
 *      JS exceptions + Supabase AuthError).
 *   2. Plain object with a `.message` property — used by Supabase
 *      PostgrestError (`{message, details, hint, code}`), GoTrueError,
 *      and other Supabase sub-package errors. Without this branch,
 *      `String(error)` would yield `[object Object]` and hide the real
 *      problem (the cause of the runtime "Supabase (getOwnProfile):
 *      [object Object]" bug in error_01.png).
 *   3. Anything else — fall back to `String(e)`.
 */
export function wrapSupabaseError(label: string, e: unknown): never {
  let msg: string
  if (e instanceof Error) {
    msg = e.message
  } else if (typeof e === 'object' && e !== null && 'message' in e) {
    msg = String((e as { message: unknown }).message)
  } else {
    msg = String(e)
  }
  throw new Error(label ? `Supabase (${label}): ${msg}` : `Supabase: ${msg}`)
}

/**
 * Build the failure branch of an `ActionResult` from a thrown error.
 * Prefers the thrown error's own message; falls back to a caller-supplied
 * Thai / English phrase when the error is not a normal `Error` (e.g.
 * a string thrown by a third-party lib).
 */
export function actionFail(
  e: unknown,
  fallback: string,
): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : fallback }
}
