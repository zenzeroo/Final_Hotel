'use server'

/**
 * Phase 17 — Payment server actions.
 *
 * Shape: canonical `ActionResult<T>` (mirrors app/actions/manager.ts:12-14).
 *
 *   - createCheckoutSessionAction: opens a Stripe Checkout Session for
 *     an unpaid booking. Callable by the booking owner OR staff (walk-in
 *     paying on behalf of guest). The RPC `create_payment_session`
 *     enforces auth via SECURITY DEFINER — this action layer doesn't
 *     need `requireRole()` (which would force every caller to be staff).
 *
 *   - markCashPaidAction: walk-in cash payment. Staff-only. Bypasses
 *     Stripe entirely (DB-only path). Records a `payments` row with
 *     provider='cash' for accounting uniformity.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { env, hasPaymentGateway } from '@/lib/env'
import { stripe } from '@/lib/payments/stripe'
import { buildCheckoutIdempotencyKey } from '@/lib/payments/idempotency'
import {
  createPaymentSession,
  updatePaymentSessionId,
} from '@/lib/data/payments'
import { getBookingPaymentStatus } from '@/lib/data/bookings'
import { UUID_RE } from '@/lib/ids'
import { getSession } from '@/lib/supabase/getSession'
import { translateSupabaseError } from '@/lib/errors/translate'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const createCheckoutSessionSchema = z.object({
  bookingId: z.string().regex(UUID_RE, 'bookingId must be a UUID'),
})

/**
 * Create a Stripe Checkout Session for an unpaid booking and return
 * the session URL for the client to redirect to.
 *
 * Idempotency:
 *   - Stripe SDK uses `idempotencyKey` so a double-click in the browser
 *     returns the same session instead of creating two.
 *   - The `create_payment_session` RPC also dedupes on existing pending
 *     rows so an in-flight retry uses the same `payments.id`.
 */
export async function createCheckoutSessionAction(
  input: { bookingId: string },
): Promise<ActionResult<{ url: string }>> {
  const parsed = createCheckoutSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }

  // No Stripe SDK = no checkout possible. Surface early so callers
  // (ConfirmationActions, WalkInForm) can render a clean error.
  if (!hasPaymentGateway || !stripe) {
    return { ok: false, error: 'Payment gateway not configured' }
  }

  // 1. Reserve the payment row (owner/staff enforced via RPC).
  let payment
  try {
    payment = await createPaymentSession({ bookingId: parsed.data.bookingId })
  } catch (e) {
    return actionFail(e, 'ไม่สามารถสร้างการชำระเงินได้')
  }

  // 2. Open the Stripe Checkout Session.
  const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const successUrl = `${appUrl}/bookings/${parsed.data.bookingId}?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${appUrl}/bookings/${parsed.data.bookingId}?cancelled=1`

  let session
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card', 'promptpay'],
        line_items: [
          {
            price_data: {
              currency: 'thb',
              product_data: {
                name: `Zenzero Hotel — Booking ${parsed.data.bookingId.slice(0, 8)}`,
              },
              unit_amount: Math.round(Number(payment.amount) * 100), // THB → satang
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          booking_id: parsed.data.bookingId,
          payment_id: payment.id,
        },
      },
      {
        idempotencyKey: buildCheckoutIdempotencyKey(parsed.data.bookingId),
      },
    )
  } catch (e) {
    return actionFail(e, 'Stripe error: ไม่สามารถเปิดหน้าชำระเงินได้')
  }

  if (!session.url) {
    return { ok: false, error: 'Stripe returned no checkout URL' }
  }

  // 3. Persist the Stripe session id + URLs back to the pending payments row.
  //    Use the admin client because user-context RLS would block this UPDATE
  //    (the owner has SELECT only on payments — see RLS policy).
  try {
    await updatePaymentSessionId({
      paymentId: payment.id,
      sessionId: session.id,
      successUrl,
      cancelUrl,
    })
  } catch (e) {
    // Non-fatal — webhook handler will still find the booking via metadata.
    console.warn('[createCheckoutSessionAction] failed to persist session_id:', e)
  }

  return { ok: true, data: { url: session.url } }
}

const markCashPaidSchema = z.object({
  bookingId: z.string().regex(UUID_RE, 'bookingId must be a UUID'),
  note: z.string().max(280).optional().nullable(),
})

/**
 * Mark a booking as paid via cash (walk-in flow). Staff-only.
 *
 * Records a `payments` row with provider='cash' so the accounting path
 * is uniform — manager dashboard can sum all payments regardless of
 * provider. Booking.payment_status flips to 'paid' in the same call.
 */
export async function markCashPaidAction(
  input: { bookingId: string; note?: string | null },
): Promise<ActionResult> {
  const session = await requireRole(
    ['reception', 'manager', 'admin'],
    '/reception/bookings',
  )
  const parsed = markCashPaidSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }

  const supabase = await createClient()

  try {
    // 1. Read booking total (cash payment row mirrors the booking amount).
    const { data: booking, error: readErr } = await supabase
      .from('bookings')
      .select('id, total, currency')
      .eq('id', parsed.data.bookingId)
      .maybeSingle()
    if (readErr) throw readErr
    if (!booking) {
      return { ok: false, error: 'ไม่พบการจอง' }
    }

    // 2. Insert payments row (cash, succeeded).
    const { error: payErr } = await supabase.from('payments').insert({
      booking_id: booking.id,
      provider: 'cash',
      payment_method: 'cash',
      amount: booking.total ?? 0,
      currency: booking.currency ?? 'THB',
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      metadata: {
        note: parsed.data.note ?? null,
        actor_id: session.id,
        actor_role: session.role,
      },
    })
    if (payErr) throw payErr

    // 3. Flip booking payment_status (bookings.staff update RLS covers this).
    const { error: bookErr } = await supabase
      .from('bookings')
      .update({ payment_status: 'paid' })
      .eq('id', booking.id)
    if (bookErr) throw bookErr

    // 4. Audit row.
    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: booking.id,
      actor_id: session.id,
      actor_role: session.role,
      event_type: 'payment_confirmed',
      description: 'Walk-in cash payment',
      metadata: { provider: 'cash', note: parsed.data.note ?? null },
    })

    revalidatePath(`/bookings/${booking.id}`)
    revalidatePath('/reception/bookings')
    revalidatePath('/manager')

    // Phase 20 #25 — fire payment_receipt for cash payments. The
    // webhook route has its own firePaymentReceipt helper; replicate
    // here with a fresh admin client to keep the dependencies local.
    try {
      const { sendEmail } = await import('@/lib/email/resend')
      const { PaymentReceiptEmail } = await import('@/lib/email/templates/payment-receipt')
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = await createAdminClient()
      const { data: freshBooking } = await admin
        .from('bookings')
        .select('id, booking_code, booker_email, booker_full_name, total, currency')
        .eq('id', booking.id)
        .single()
      if (freshBooking && freshBooking.booker_email) {
        const { data: payment } = await admin
          .from('payments')
          .select('id, amount, paid_at')
          .eq('booking_id', booking.id)
          .eq('status', 'succeeded')
          .order('paid_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (payment) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
          await sendEmail({
            to: freshBooking.booker_email,
            template: 'payment_receipt',
            subject: `[Zenzero] ใบเสร็จการจอง ${freshBooking.booking_code}`,
            react: PaymentReceiptEmail({
              bookingCode: freshBooking.booking_code,
              guestName: freshBooking.booker_full_name ?? '',
              amount: Number(payment.amount),
              currency: freshBooking.currency,
              method: 'cash',
              paidAt: payment.paid_at ?? new Date().toISOString(),
              viewUrl: `${appUrl}/bookings/${freshBooking.id}`,
            }),
            eventKey: `payment_receipt:booking:${freshBooking.id}:cash:${payment.id}`,
            bookingId: freshBooking.id,
            paymentId: payment.id,
            metadata: { method: 'cash', actor_id: session.id },
          })
        }
      }
    } catch (e) {
      console.error('[payment_receipt cash] email dispatch failed:', e)
    }

    return { ok: true }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถบันทึกการชำระเงินสดได้: ' + translateSupabaseError(e instanceof Error ? e.message : String(e)))
  }
}

/**
 * Phase 27 — lightweight polling action for the Stripe success modal
 * (components/payment/PaymentSuccessModal.tsx). Called from the client
 * every 2s after Stripe redirects the user to
 * /bookings/[id]?session_id=cs_… because the webhook may not have
 * flipped bookings.payment_status to 'paid' yet at the time the page
 * server-renders — the polling loop waits for that DB flip before
 * swapping the modal from "processing" to "success".
 *
 * RLS-safe via the user-context createClient() — only returns data
 * for bookings the caller owns. Returns null when the booking
 * doesn't exist OR the user doesn't own it (RLS denies); the caller
 * keeps polling until max-attempts (30s) and shows the timeout view.
 */
export async function pollBookingPaymentStatusAction(
  bookingId: string,
): Promise<
  ActionResult<{
    paymentStatus: 'unpaid' | 'paid' | 'refunded' | 'partial_refund' | null
  }>
> {
  if (!bookingId || !UUID_RE.test(bookingId)) {
    return { ok: false, error: 'รหัสการจองไม่ถูกต้อง' }
  }
  const session = await getSession()
  if (!session) {
    return { ok: false, error: 'กรุณาเข้าสู่ระบบ' }
  }
  const status = await getBookingPaymentStatus(bookingId, session.id)
  return { ok: true, data: { paymentStatus: status } }
}