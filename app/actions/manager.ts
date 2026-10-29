'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPaymentGateway } from '@/lib/env'
import { stripe } from '@/lib/payments/stripe'
import { buildRefundIdempotencyKey } from '@/lib/payments/idempotency'
import { listPaymentsByBooking } from '@/lib/data/payments'
import {
  resolveDamageReport,
  approveRefund,
  rejectRefund,
} from '@/lib/data/manager'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export async function resolveDamageReportAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(['manager', 'admin'], '/manager')

  const reportId = String(formData.get('reportId') ?? '').trim()
  const costRaw = String(formData.get('costEstimate') ?? '').trim()
  const note = String(formData.get('resolutionNote') ?? '').trim().slice(0, 500)

  if (!reportId) return { ok: false, error: 'Missing report id' }
  const costEstimate = Number(costRaw)
  if (!Number.isFinite(costEstimate) || costEstimate < 0) {
    return { ok: false, error: 'Cost estimate must be a non-negative number' }
  }
  if (!note) return { ok: false, error: 'Please add a resolution note' }

  try {
    await resolveDamageReport({
      reportId,
      costEstimate,
      resolutionNote: note,
      // Phase 9B: store the actor's profile UUID in damage_reports.resolved_by (FK).
      // The display label is resolved in the SELECT join inside the data layer.
      resolvedBy: session.id,
    })
  } catch (e) {
    return actionFail(e, 'Could not resolve report')
  }

  revalidatePath('/manager')
  revalidatePath('/manager/housekeeping')
  return { ok: true }
}

/**
 * Phase 18 — manager-initiated refund approval.
 *
 * Critical ordering (D5 — see CLAUDE.md "Stripe refund action ordering"):
 *   1. Read refund_request + linked Stripe payment (if any).
 *   2. Call `stripe.refunds.create()` FIRST. If it throws (network, expired
 *      PI, declined) → actionFail + STOP. DB stays untouched so the manager
 *      can retry. NEVER flip DB before Stripe succeeds — half-refund is
 *      unrecoverable (guest sees "refunded" but card was never credited).
 *   3. Call `approve_refund` RPC to flip DB state atomically. The RPC now
 *      handles partial vs full payment_status via aggregation of ALL
 *      approved refunds vs succeeded payments for the booking (Phase 19 #19).
 *      No action-layer override needed — the RPC is the source of truth.
 *   4. Insert a `booking_events` audit row (event_type='refund_approved').
 *      The `approve_refund` RPC does NOT insert this row (Phase 10
 *      oversight — fixed here per D6).
 *
 * If `hasPaymentGateway=false` OR no Stripe payment on the booking (cash),
 * the action skips step 2 entirely — DB-only flip is correct for cash
 * refunds.
 */
export async function approveRefundAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(['manager', 'admin'], '/manager')

  const refundId = String(formData.get('refundId') ?? '').trim()
  if (!refundId) return { ok: false, error: 'Missing refund id' }

  let partialRefund = false
  let stripeRefundId: string | null = null

  try {
    const supabase = await createClient()

    // 1. Read the refund request to learn its booking + amount.
    const { data: rr, error: rrErr } = await supabase
      .from('refund_requests')
      .select('id, booking_id, amount, status')
      .eq('id', refundId)
      .maybeSingle()
    if (rrErr) throw rrErr
    if (!rr) return { ok: false, error: 'ไม่พบคำขอคืนเงิน' }
    // approve_refund refuses a decided request, but only AFTER Stripe has
    // already paid out — check first so a rejected / already-approved
    // request never reaches stripe.refunds.create().
    if (rr.status !== 'pending') {
      return { ok: false, error: 'คำขอคืนเงินนี้ถูกพิจารณาไปแล้ว' }
    }

    // 2. Find a Stripe payment for the linked booking (only if it's
    //    succeeded + has a Stripe payment_intent). Cash bookings have
    //    provider='cash' with `provider_payment_id=null` → skipped below.
    const payments = await listPaymentsByBooking(rr.booking_id)
    const stripePayment = payments.find(
      (p) => p.provider === 'stripe' && p.provider_payment_id && p.status === 'succeeded',
    )

    // 3. Stripe call (only if gateway configured AND a Stripe payment exists).
    if (hasPaymentGateway && stripe && stripePayment?.provider_payment_id) {
      partialRefund = Number(rr.amount) < Number(stripePayment.amount)
      try {
        const refund = await stripe.refunds.create(
          {
            payment_intent: stripePayment.provider_payment_id,
            // Partial refund: pass the amount in the smallest currency unit
            // (e.g. satoshi/cent). Stripe accepts THB at 100× scale.
            ...(partialRefund ? { amount: Math.round(Number(rr.amount) * 100) } : {}),
          },
          { idempotencyKey: buildRefundIdempotencyKey(refundId) },
        )
        stripeRefundId = refund.id
      } catch (e) {
        // STRIPE FAILED — DO NOT TOUCH DB. Manager can retry.
        return actionFail(
          e,
          'Stripe refund failed: ไม่สามารถคืนเงินผ่าน Stripe ได้ — กรุณาลองอีกครั้ง',
        )
      }
    }

    // 4. DB flip via the existing RPC. As of Phase 19 #19, the RPC handles
    //    aggregation across multiple approved refunds — no action-layer
    //    override needed. The `partialRefund` flag above is still computed
    //    for the Stripe call + audit row + email template, but the final
    //    payment_status label is decided by the RPC's SUM-vs-SUM logic.
    await approveRefund({ refundId })

    // 6. Audit row. `approve_refund` RPC never inserted one (Phase 10
    //    oversight) — the action layer has `session.id` + `session.role`
    //    so we record the manager's decision here. Webhook-driven
    //    `refund_confirmed` rows come later via `confirm_refund_session`.
    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: rr.booking_id,
      actor_id: session.id,
      actor_role: session.role,
      event_type: 'refund_approved',
      description: 'Refund approved — Stripe refund initiated',
      metadata: {
        refund_id: refundId,
        amount: rr.amount,
        stripe_refund_id: stripeRefundId,
        partial: partialRefund,
      },
    })

    // Phase 20 #25 — fire refund_notice AFTER the DB flip + Stripe refund
    // succeeded (inside the try block so we can reference `rr`). Fire-and-
    // forget — email failure must not roll back the refund approval.
    try {
      const adminEmail = await createAdminClient()
      const { data: booking } = await adminEmail
        .from('bookings')
        .select('id, user_id, booking_code, booker_email, booker_full_name, currency')
        .eq('id', rr.booking_id)
        .single()
      if (booking) {
        const { notifyUser } = await import('@/lib/notifications/notify')
        await notifyUser(booking.user_id, {
          type: 'refund_approved',
          params: { code: booking.booking_code, amount: Number(rr.amount) },
          link: `/bookings/${booking.id}`,
          bookingId: booking.id,
          eventKey: `refund_approved:${refundId}`,
        })
      }
      if (booking && booking.booker_email) {
        const { sendEmail } = await import('@/lib/email/resend')
        const { RefundNoticeEmail, refundNoticeSubject } = await import('@/lib/email/templates/refund-notice')
        const { getRecipientLocale } = await import('@/lib/email/recipient-locale')
        const emailLocale = await getRecipientLocale({ userId: booking.user_id })
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        await sendEmail({
          to: booking.booker_email,
          template: 'refund_notice',
          subject: refundNoticeSubject({ bookingCode: booking.booking_code, locale: emailLocale }),
          react: RefundNoticeEmail({
            locale: emailLocale,
            bookingCode: booking.booking_code,
            guestName: booking.booker_full_name ?? '',
            refundAmount: Number(rr.amount),
            currency: booking.currency,
            partial: partialRefund,
            etaDays: 7,
            viewUrl: `${appUrl}/bookings/${booking.id}`,
          }),
          eventKey: `refund_notice:refund_request:${refundId}`,
          bookingId: booking.id,
          refundRequestId: refundId,
          metadata: { stripe_refund_id: stripeRefundId, partial: partialRefund },
        })
      }
    } catch (e) {
      console.error('[refund_notice] email dispatch failed:', e)
    }
  } catch (e) {
    return actionFail(e, 'Could not approve refund')
  }

  revalidatePath('/manager')
  revalidatePath('/manager/bookings')
  // Phase 55 — approval now cancels the booking, so the guest's list changes too.
  revalidatePath('/bookings')
  return { ok: true }
}

export async function rejectRefundAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(['manager', 'admin'], '/manager')

  const refundId = String(formData.get('refundId') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500)
  if (!refundId) return { ok: false, error: 'Missing refund id' }
  if (!reason) return { ok: false, error: 'Please provide a rejection reason' }

  let bookingId: string | null = null
  try {
    const supabase = await createClient()
    const { data: rr } = await supabase
      .from('refund_requests')
      .select('booking_id')
      .eq('id', refundId)
      .maybeSingle()
    bookingId = rr?.booking_id ?? null

    await rejectRefund({ refundId, reason })
  } catch (e) {
    return actionFail(e, 'Could not reject refund')
  }

  // Phase 55 — a reject leaves the booking valid (guest keeps the stay).
  // Record it + tell the guest; neither may undo the decision if it fails.
  if (bookingId) {
    try {
      const admin = await createAdminClient()
      await admin.from('booking_events').insert({
        booking_id: bookingId,
        actor_id: session.id,
        actor_role: session.role,
        event_type: 'refund_rejected',
        description: 'Refund request rejected — booking remains valid',
        metadata: { refund_id: refundId, reason },
      })

      const { data: booking } = await admin
        .from('bookings')
        .select('id, user_id, booking_code, booker_email, booker_full_name')
        .eq('id', bookingId)
        .single()
      if (booking) {
        const { notifyUser } = await import('@/lib/notifications/notify')
        await notifyUser(booking.user_id, {
          type: 'refund_rejected',
          params: { code: booking.booking_code },
          link: `/bookings/${booking.id}`,
          bookingId: booking.id,
          eventKey: `refund_rejected:${refundId}`,
        })
      }
      if (booking?.booker_email) {
        const { sendEmail } = await import('@/lib/email/resend')
        const { RefundRejectedEmail, refundRejectedSubject } = await import('@/lib/email/templates/refund-rejected')
        const { getRecipientLocale } = await import('@/lib/email/recipient-locale')
        const emailLocale = await getRecipientLocale({ userId: booking.user_id })
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        await sendEmail({
          to: booking.booker_email,
          template: 'refund_rejected',
          subject: refundRejectedSubject({ bookingCode: booking.booking_code, locale: emailLocale }),
          react: RefundRejectedEmail({
            locale: emailLocale,
            bookingCode: booking.booking_code,
            guestName: booking.booker_full_name ?? '',
            reason,
            viewUrl: `${appUrl}/bookings/${booking.id}`,
          }),
          eventKey: `refund_rejected:refund_request:${refundId}`,
          bookingId: booking.id,
          refundRequestId: refundId,
        })
      }
    } catch (e) {
      console.error('[refund_rejected] audit/email failed:', e)
    }
  }

  revalidatePath('/manager')
  revalidatePath('/manager/bookings')
  revalidatePath('/bookings')
  return { ok: true }
}
