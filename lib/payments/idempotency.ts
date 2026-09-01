/**
 * Phase 17 — Idempotency key builder for Stripe SDK requests.
 *
 * Used as the `idempotencyKey` option on `stripe.checkout.sessions.create()`.
 * If the same booking triggers session creation twice within Stripe's
 * idempotency window (24h), Stripe returns the original session instead
 * of creating a duplicate.
 */

export function buildCheckoutIdempotencyKey(bookingId: string): string {
  return `booking:${bookingId}:create-session`
}