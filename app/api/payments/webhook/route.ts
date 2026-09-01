/**
 * Phase 17 — Stripe webhook receiver.
 *
 * Stripe has no cookie. Auth is HMAC: the `stripe-signature` header is
 * computed from (rawBody, secret) by Stripe; we re-verify via
 * `stripe.webhooks.constructEvent`. A re-serialized body (via `.json()`)
 * would break the signature — must use `request.text()`.
 *
 * Status code policy:
 *   - 400 → invalid signature. Stripe stops retrying; don't burn cycles
 *     on forged traffic.
 *   - 500 → transient DB/RPC error. Stripe retries with exponential
 *     backoff up to 3 days.
 *   - 200 → success + unhandled event types. Stripe marks delivered.
 *
 * All DB writes go through SECURITY DEFINER RPCs (`confirm_payment_session`,
 * `expire_payment_session`). The RPC `provider_event_id` UNIQUE gives
 * us idempotency — replayed webhooks return the same row silently.
 */

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { env, hasPaymentGateway } from '@/lib/env'
import { stripe } from '@/lib/payments/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard: payment gateway must be configured to handle webhooks.
  if (!hasPaymentGateway || !stripe) {
    return new NextResponse('Payment gateway not configured', { status: 500 })
  }

  // 1. HMAC verification — needs the raw body, NOT parsed JSON.
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new NextResponse('Missing stripe-signature header', { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return new NextResponse(`Invalid signature: ${msg}`, { status: 400 })
  }

  // 2. Dispatch. All handlers call SECURITY DEFINER RPCs (admin client
  //    so we can invoke them; the RPC is GRANTED to `service_role`).
  const admin = await createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : ''
        const { error } = await admin.rpc('confirm_payment_session', {
          p_session_id: session.id,
          p_event_id: event.id,
          p_payment_id: paymentIntentId,
        })
        if (error) throw error
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const { error } = await admin.rpc('expire_payment_session', {
          p_session_id: session.id,
          p_event_id: event.id,
        })
        if (error) throw error
        break
      }

      // Phase 18: charge.refunded → flip payments.status='refunded'
      // + bookings.payment_status='refunded' + audit row.
      default:
        // Ack unhandled events so Stripe stops retrying.
        break
    }
  } catch (err) {
    // Log server-side, surface 500 so Stripe retries.
    console.error('[payments/webhook]', event.type, err)
    return new NextResponse('Handler error', { status: 500 })
  }

  return NextResponse.json({ received: true })
}