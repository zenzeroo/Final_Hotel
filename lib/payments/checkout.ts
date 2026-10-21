import type Stripe from 'stripe'
import { buildCheckoutIdempotencyKey } from './idempotency'

/** Reuse an open session only if the guest still has this long to pay on it. */
const MIN_REMAINING_MS = 2 * 60 * 1000

export type OpenCheckoutResult =
  | { kind: 'reused'; session: Stripe.Checkout.Session }
  | { kind: 'created'; session: Stripe.Checkout.Session }
  | { kind: 'already_paid' }

/**
 * Return a payable Checkout Session for a pending payment row.
 *
 * Coming back from Stripe (browser Back, or the cancel link) and clicking
 * Pay again must not open a second session while the first is still open —
 * two open sessions for one booking risk a double payment. So:
 *   1. If the row's stored session is still open with time left → reuse it.
 *   2. If it was completed → the payment is already going through.
 *   3. Otherwise (expired / about to expire / unknown) → create a new one.
 *
 * The idempotency key covers every param that changes between attempts:
 * `expires_at` is derived from the same minute bucket as the key, so a
 * double-click inside one minute sends an identical request (Stripe returns
 * the same session) and a later retry uses a fresh key instead of tripping
 * "Keys for idempotent requests can only be used with the same parameters".
 */
export async function openCheckoutSession(
  stripe: Stripe,
  payment: { id: string; provider_session_id: string | null },
  params: Omit<Stripe.Checkout.SessionCreateParams, 'expires_at'> & { bookingId: string },
  nowMs: number = Date.now(),
): Promise<OpenCheckoutResult> {
  if (payment.provider_session_id) {
    let existing: Stripe.Checkout.Session | null = null
    try {
      existing = await stripe.checkout.sessions.retrieve(payment.provider_session_id)
    } catch {
      existing = null // unknown/deleted session id → just create a new one
    }
    if (existing?.status === 'complete') return { kind: 'already_paid' }
    if (existing?.status === 'open' && existing.url) {
      if (existing.expires_at * 1000 - nowMs > MIN_REMAINING_MS) {
        return { kind: 'reused', session: existing }
      }
      // Too close to expiry to be useful — close it so only one stays payable.
      await stripe.checkout.sessions.expire(existing.id).catch(() => undefined)
    }
  }

  const { bookingId, ...createParams } = params
  const bucket = Math.floor(nowMs / 60_000)
  const session = await stripe.checkout.sessions.create(
    // Stripe requires expires_at ≥ 30 min ahead; bucket start + 31 min always is.
    { ...createParams, expires_at: (bucket + 31) * 60 },
    {
      idempotencyKey: buildCheckoutIdempotencyKey(bookingId, payment.id, payment.provider_session_id, bucket),
    },
  )
  return { kind: 'created', session }
}
