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
 * `expire_payment_session`, `confirm_refund_session` — Phase 18). The RPC
 * `provider_event_id` UNIQUE gives us idempotency — replayed webhooks
 * return the same row silently.
 */

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { env, hasPaymentGateway } from '@/lib/env'
import { stripe } from '@/lib/payments/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'

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

        // Phase 20 #25 — fire payment_receipt after the DB flip succeeded.
        // The RPC wrote the payments row; load it + booking + guest for the
        // template body. Fire-and-forget — webhook must return 200 quickly.
        const bookingId = (session.metadata?.booking_id ?? null) as string | null
        if (bookingId) {
          await firePaymentReceipt(bookingId, session.id, 'card').catch((e) =>
            console.error('[payment_receipt webhook] failed:', e),
          )
        }
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
      // + bookings.payment_status='refunded' + audit row. The RPC is
      // idempotent on provider_event_id, so a duplicate event (Stripe
      // retries, or our own confirmation flow re-emitting) is a safe
      // no-op. We always read `payment_intent` (not `charge.id`) because
      // refunds are keyed off the PI in the confirm_refund_session RPC.
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId =
          typeof charge.payment_intent === 'string' ? charge.payment_intent : ''
        if (!paymentIntentId) {
          throw new Error('charge.refunded missing payment_intent')
        }
        const { error } = await admin.rpc('confirm_refund_session', {
          p_payment_intent: paymentIntentId,
          p_event_id: event.id,
        })
        if (error) throw error
        break
      }

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

/**
 * Phase 20 #25 — internal helper. Loads the latest succeeded payment row
 * for a booking and fires the payment_receipt template. Used by both the
 * Stripe webhook (card path) and `markCashPaidAction` (walk-in cash).
 */
async function firePaymentReceipt(
  bookingId: string,
  sessionId: string,
  method: 'card' | 'promptpay' | 'cash',
): Promise<void> {
  const admin = await createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_code, booker_email, booker_full_name, total, currency')
    .eq('id', bookingId)
    .single()
  if (!booking || !booking.booker_email) return
  const { data: payment } = await admin
    .from('payments')
    .select('id, amount, paid_at')
    .eq('booking_id', bookingId)
    .eq('status', 'succeeded')
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!payment) return

  const { PaymentReceiptEmail } = await import('@/lib/email/templates/payment-receipt')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendEmail({
    to: booking.booker_email,
    template: 'payment_receipt',
    subject: `[Zenzero] ใบเสร็จการจอง ${booking.booking_code}`,
    react: PaymentReceiptEmail({
      bookingCode: booking.booking_code,
      guestName: booking.booker_full_name ?? '',
      amount: Number(payment.amount),
      currency: booking.currency,
      method,
      paidAt: payment.paid_at ?? new Date().toISOString(),
      viewUrl: `${appUrl}/bookings/${booking.id}`,
    }),
    eventKey: `payment_receipt:booking:${booking.id}:${sessionId}`,
    bookingId: booking.id,
    paymentId: payment.id,
    metadata: { method, session_id: sessionId },
  })
}