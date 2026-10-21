/**
 * Phase 17 — Idempotency key builder for Stripe SDK requests.
 *
 * Used as the `idempotencyKey` option on `stripe.checkout.sessions.create()`
 * and `stripe.refunds.create()`. If the same booking/refund triggers the
 * same call twice within Stripe's idempotency window (24h), Stripe returns
 * the original resource instead of creating a duplicate.
 */

export function buildCheckoutIdempotencyKey(
  bookingId: string,
  paymentId: string,
  replacesSessionId: string | null,
  minuteBucket: number,
): string {
  // Must cover every request param that can differ between attempts —
  // `expires_at` is derived from `minuteBucket` (see lib/payments/checkout.ts).
  // `replacesSessionId` keeps a replacement for an expired session from
  // replaying the cached (expired) original within the same minute.
  return `booking:${bookingId}:payment:${paymentId}:after:${replacesSessionId ?? 'none'}:session:${minuteBucket}`
}

/**
 * Phase 18 — Idempotency key for `stripe.refunds.create()`.
 *
 * Keyed off the `refund_requests.id` (UUID) so two manager clicks on the
 * same refund request within 24h produce the same Stripe refund object —
 * Stripe returns the original refund id and never charges the customer
 * twice. The DB-side `approve_refund` RPC guards against double-decision
 * for the *request*, but Stripe needs its own idempotency token for the
 * API call itself.
 */
export function buildRefundIdempotencyKey(refundId: string): string {
  return `refund:${refundId}`
}