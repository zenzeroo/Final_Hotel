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
import { getRecipientLocale } from '@/lib/email/recipient-locale'
import { notifyUser } from '@/lib/notifications/notify'
import { getRefundNotice } from '@/lib/data/bookings'

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
        const bookingId = (session.metadata?.booking_id ?? null) as string | null

        // Phase 52 follow-up — RACE check (recommended default:
        // re-confirm if capacity is still free, otherwise auto-refund).
        //   1. If the booking is still active (confirmed+unpaid or
        //      temp_pending+unpaid), this is the normal happy path.
        //   2. If the booking is in a terminal state (cancelled,
        //      expired, etc.), check capacity. If free: re-confirm
        //      (flip bookings.status back to 'confirmed' and
        //      payment_status='paid'). If full: auto-refund.
        if (bookingId) {
          const { data: booking } = await admin
            .from('bookings')
            .select('id, user_id, status, payment_status, payment_due_at, booker_email, booker_full_name, booking_code, total, currency')
            .eq('id', bookingId)
            .single()
          // Phase 56 — past its deadline but not yet flipped by the
          // per-minute job: capacity checks already ignore it, so the room
          // may be re-sold. Treat it like an expired booking.
          const overdueUnpaid =
            booking?.status === 'confirmed' &&
            booking.payment_status === 'unpaid' &&
            booking.payment_due_at !== null &&
            new Date(booking.payment_due_at).getTime() <= Date.now()
          if (
            booking &&
            (booking.status === 'cancelled' ||
              booking.status === 'expired' ||
              booking.status === 'payment_expired' ||
              overdueUnpaid)
          ) {
            // Capacity check (the booking was terminal because the
            // customer cancelled or the deadline lapsed; we want to
            // honor the payment only if the room is still free).
            const { data: hasCap } = await admin.rpc(
              'has_capacity_for_booking',
              { p_booking_id: bookingId },
            )

            if (hasCap === true) {
              // RECONFIRM — restore the booking to 'confirmed' + 'paid'
              // and audit. The customer's history will show a normal
              // paid booking. We don't re-create the payment row (the
              // existing pending one flips to 'succeeded' via
              // confirm_payment_session).
              await admin.rpc('confirm_payment_session', {
                p_session_id: session.id,
                p_event_id: event.id,
                p_payment_id: paymentIntentId,
              })
              // Restore the row to 'confirmed' if it was 'cancelled' or
              // 'expired' (the RPC doesn't touch bookings.status, just
              // payments + bookings.payment_status). Walk-in records
              // (which were 'cancelled' deliberately) get the same
              // treatment — we re-open them. The customer gets a paid
              // booking either way.
              await admin
                .from('bookings')
                .update({ status: 'confirmed', lapsed_reason: null, payment_due_at: null })
                .eq('id', bookingId)
              await admin.from('booking_events').insert({
                booking_id: bookingId,
                actor_id: null,
                actor_role: 'admin',
                event_type: 'payment_recovered',
                description: `Stripe charge arrived for ${booking.status} booking — recovered (capacity was free)`,
                metadata: {
                  event_id: event.id,
                  payment_intent: paymentIntentId || null,
                },
              })
              // Fire payment_receipt so the customer gets the email.
              await firePaymentReceipt(bookingId, session.id, 'card').catch(
                (e) => console.error('[payment_receipt webhook] failed:', e),
              )
              return NextResponse.json({
                received: true,
                action: 'payment_recovered',
              })
            }

            // AUTO-REFUND — capacity is taken, the customer paid for a
            // room that's no longer theirs. Refund + audit + email.
            let refundOk = true
            let refundErr: string | null = null
            if (paymentIntentId) {
              try {
                await stripe.refunds.create(
                  { payment_intent: paymentIntentId },
                  { idempotencyKey: `auto-refund:${event.id}` },
                )
              } catch (e) {
                refundOk = false
                refundErr = e instanceof Error ? e.message : String(e)
                console.error('[webhook] auto-refund failed:', refundErr)
                // Still proceed to audit + email — the DB is the source
                // of truth and Stripe will retry the refund later.
              }
            }
            await admin.from('booking_events').insert({
              booking_id: bookingId,
              actor_id: null,
              actor_role: 'admin',
              event_type: 'auto_refund',
              description: `Stripe charge arrived for ${booking.status} booking — auto-refunded (capacity full)`,
              metadata: {
                event_id: event.id,
                payment_intent: paymentIntentId || null,
                refund_ok: refundOk,
                refund_error: refundErr,
              },
            })
            // Notify the customer.
            await notifyUser(booking.user_id, {
              type: 'payment_auto_refunded',
              params: { code: booking.booking_code, amount: Number(booking.total) },
              link: `/bookings/${booking.id}`,
              bookingId,
              eventKey: `payment_auto_refunded:${event.id}`,
            })
            if (booking.booker_email) {
              try {
                const { RefundNoticeEmail, refundNoticeSubject } = await import(
                  '@/lib/email/templates/refund-notice'
                )
                const emailLocale = await getRecipientLocale({ bookingId })
                const appUrl = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
                await sendEmail({
                  to: booking.booker_email,
                  template: 'refund_notice',
                  subject: refundNoticeSubject({ bookingCode: booking.booking_code, locale: emailLocale }),
                  react: RefundNoticeEmail({
                    locale: emailLocale,
                    auto: true,
                    bookingCode: booking.booking_code,
                    guestName: booking.booker_full_name ?? '',
                    refundAmount: Number(booking.total),
                    currency: booking.currency,
                    viewUrl: `${appUrl}/bookings/${booking.id}`,
                    // Auto-refund (race) = full refund of the original
                    // booking total, not a partial.
                    partial: false,
                    etaDays: 7,
                  }),
                  eventKey: `refund_notice:auto:${bookingId}:${event.id}`,
                  bookingId,
                  metadata: {
                    trigger: 'auto_refund_race',
                    event_id: event.id,
                  },
                })
              } catch (e) {
                console.error('[webhook] auto-refund email failed:', e)
              }
            }
            // Return 200 so Stripe stops retrying. The race was handled.
            return NextResponse.json({
              received: true,
              action: 'auto_refund',
              refundOk,
            })
          }
        }

        // Normal happy path — booking is still active.
        const { error } = await admin.rpc('confirm_payment_session', {
          p_session_id: session.id,
          p_event_id: event.id,
          p_payment_id: paymentIntentId,
        })
        if (error) throw error

        // Phase 20 #25 — fire payment_receipt after the DB flip succeeded.
        // The RPC wrote the payments row; load it + booking + guest for the
        // template body. Fire-and-forget — webhook must return 200 quickly.
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
    .select('id, user_id, booking_code, booker_email, booker_full_name, total, currency, check_in')
    .eq('id', bookingId)
    .single()
  if (!booking) return
  const { data: payment } = await admin
    .from('payments')
    .select('id, amount, paid_at')
    .eq('booking_id', bookingId)
    .eq('status', 'succeeded')
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!payment) return

  await notifyUser(booking.user_id, {
    type: 'payment_received',
    params: { code: booking.booking_code, amount: Number(payment.amount) },
    link: `/bookings/${booking.id}`,
    bookingId,
    eventKey: `payment_received:${payment.id}`,
  })
  if (!booking.booker_email) return

  const { PaymentReceiptEmail, paymentReceiptSubject } = await import('@/lib/email/templates/payment-receipt')
  const emailLocale = await getRecipientLocale({ userId: booking.user_id })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendEmail({
    to: booking.booker_email,
    template: 'payment_receipt',
    subject: paymentReceiptSubject({ bookingCode: booking.booking_code, locale: emailLocale }),
    react: PaymentReceiptEmail({
      locale: emailLocale,
      bookingCode: booking.booking_code,
      guestName: booking.booker_full_name ?? '',
      amount: Number(payment.amount),
      currency: booking.currency,
      method,
      paidAt: payment.paid_at ?? new Date().toISOString(),
      viewUrl: `${appUrl}/bookings/${booking.id}`,
      refund: await getRefundNotice(booking.check_in),
    }),
    eventKey: `payment_receipt:booking:${booking.id}:${sessionId}`,
    bookingId: booking.id,
    paymentId: payment.id,
    metadata: { method, session_id: sessionId },
  })
}