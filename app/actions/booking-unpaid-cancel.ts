'use server'

/**
 * Phase 52 — Cancel an unpaid booking on /bookings/[id].
 *
 * Called by the leave-guard when the customer confirms "ยกเลิกรายการ"
 * (or by the new "ยกเลิกรายการ" button on the return-from-Stripe banner).
 *
 * Two paths:
 *   - status='temp_pending'  → use existing cancelTempBookingAction
 *     (no Stripe session exists yet at this point — /rooms/[id] opens
 *     the Stripe tab only after /bookings/new submit, which flips
 *     status to 'confirmed' first)
 *   - status='confirmed' + payment_status='unpaid'
 *     → try to expire the open Stripe Checkout Session. If the Stripe
 *     call fails because the session is already `complete` (race
 *     with the webhook), DON'T cancel — treat the booking as paid by
 *     calling `confirm_payment_session` and return status='paid' so
 *     the caller refreshes the page to show the paid state.
 *     → otherwise, use the existing `cancel_booking` RPC (no refund
 *     row created because `cancel_booking` zeros the refund when
 *     payment_status<>'paid')
 *     → fire the cancellation_notice email (matches the existing
 *     `fireCancellationNotice` helper)
 *
 * Owner-checked at the action layer (Phase 11 RBAC pattern). The RPCs
 * also enforce ownership server-side as defense in depth.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { isUuid } from '@/lib/ids'
import { expireCheckoutSessionAction } from './payment'
import { hasPaymentGateway } from '@/lib/env'
import { stripe } from '@/lib/payments/stripe'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const cancelUnpaidBookingSchema = (z: typeof import('zod').z) =>
  z.object({ bookingId: z.string().uuid() })

export async function cancelUnpaidBookingAction(
  input: { bookingId: string },
): Promise<ActionResult<{ status: string }>> {
  const { z } = await import('zod')
  const parsed = cancelUnpaidBookingSchema(z).safeParse(input)
  if (!parsed.success || !isUuid(parsed.data.bookingId)) {
    return { ok: false, error: 'รหัสการจองไม่ถูกต้อง' }
  }

  const session = await requireRole('user', '/login')
  const supabase = await createClient()

  // 1. Read the booking — verify ownership + state BEFORE any side effects.
  const { data: booking, error: readErr } = await supabase
    .from('bookings')
    .select('id, user_id, status, payment_status')
    .eq('id', parsed.data.bookingId)
    .eq('user_id', session.id)
    .maybeSingle()
  if (readErr) {
    return actionFail(readErr, 'ไม่สามารถโหลดข้อมูลการจองได้')
  }
  if (!booking) {
    return { ok: false, error: 'ไม่พบการจองนี้' }
  }
  if (booking.status === 'cancelled') {
    return { ok: true, data: { status: 'cancelled' } }
  }
  if (booking.status === 'expired' || booking.status === 'payment_expired') {
    return { ok: true, data: { status: booking.status } }
  }
  if (booking.payment_status === 'paid') {
    return {
      ok: false,
      error: 'การจองนี้ชำระเงินแล้ว ไม่สามารถยกเลิกด้วยฟลันนี้ได้',
    }
  }
  if (booking.status === 'checked_in' || booking.status === 'checked_out') {
    return {
      ok: false,
      error: 'การจองนี้เช็คอินแล้ว ไม่สามารถยกเลิกผ่านหน้านี้ได้',
    }
  }

  // 2. Dispatch by status.
  try {
    if (booking.status === 'temp_pending') {
      // Reuse the existing temp-pending cancel path. The RPC is owner-
      // scoped and flips status to 'cancelled' + clears hold_expires_at.
      // No Stripe session exists at this point (the Stripe tab opens
      // only after /bookings/new flips status to 'confirmed'), so we
      // don't call expireCheckoutSessionAction.
      const { error } = await supabase.rpc('cancel_temp_booking', {
        p_booking_id: parsed.data.bookingId,
        p_user_id: session.id,
      })
      if (error) {
        const code = (error as { code?: string }).code
        if (code === '42501') return { ok: false, error: 'ไม่ใช่การจองของคุณ' }
        if (code === 'P0002') return { ok: false, error: 'ไม่พบการจองนี้' }
        if (code === 'P0001') {
          return {
            ok: false,
            error: 'การจองนี้ไม่อยู่ในสถานะชั่วคราวแล้ว ไม่สามารถยกเลิกได้',
          }
        }
        return {
          ok: false,
          error: 'ไม่สามารถยกเลิกการจองได้: ' + (error.message ?? 'unknown'),
        }
      }
    } else if (booking.status === 'confirmed') {
      // Phase 52 follow-up — RECONCILE-AS-PAID CHECK. Before cancelling,
      // try to expire the open Stripe Checkout Session. If Stripe
      // responds that the session is already `complete` (race: the
      // customer paid in the same moment they clicked cancel), DO
      // NOT cancel — instead mark the booking as paid by calling
      // `confirm_payment_session` (which flips bookings.payment_status
      // to 'paid' + marks the payments row 'succeeded') and return
      // status='paid' so the caller can refresh the page.
      let reconciledAsPaid = false
      const { data: pendingPayment } = await supabase
        .from('payments')
        .select('id, provider_session_id, status')
        .eq('booking_id', parsed.data.bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (
        pendingPayment &&
        pendingPayment.status === 'pending' &&
        pendingPayment.provider_session_id &&
        hasPaymentGateway &&
        stripe
      ) {
        try {
          await stripe.checkout.sessions.expire(
            pendingPayment.provider_session_id,
          )
        } catch (expireErr) {
          const msg = expireErr instanceof Error ? expireErr.message : String(expireErr)
          // Stripe's "session already complete" error path → retrieve
          // the session and verify it actually completed. If yes,
          // reconcile-as-paid and skip the cancel.
          if (
            /complete/i.test(msg) ||
            /already/i.test(msg) ||
            /cannot.*expire/i.test(msg)
          ) {
            try {
              const live = await stripe.checkout.sessions.retrieve(
                pendingPayment.provider_session_id,
              )
              if (live.payment_status === 'complete') {
                // Webhook hasn't flipped payment_status yet (or won't —
                // it's a race). Do it now.
                const admin = await createAdminClient()
                await admin.rpc('confirm_payment_session', {
                  p_session_id: pendingPayment.provider_session_id,
                  p_event_id: `reconcile-cancel:${parsed.data.bookingId}`,
                  p_payment_id:
                    typeof live.payment_intent === 'string'
                      ? live.payment_intent
                      : '',
                })
                reconciledAsPaid = true
                revalidatePath(`/bookings/${parsed.data.bookingId}`)
                revalidatePath('/bookings')
                return {
                  ok: true,
                  data: { status: 'paid' },
                }
              }
              // Session is `expired` (Stripe already expired it) →
              // safe to proceed with cancel. Fall through.
            } catch (retrieveErr) {
              console.warn(
                '[cancelUnpaidBookingAction] session retrieve failed:',
                retrieveErr,
              )
              // Fall through and try to cancel — the webhook race
              // branch will handle any late `checkout.session.completed`.
            }
          } else {
            console.warn(
              '[cancelUnpaidBookingAction] stripe.expire failed:',
              msg,
            )
          }
        }
      }

      // Use the existing `cancel_booking` RPC. The current production
      // version (20260907) already handles `payment_status='unpaid'`
      // correctly: refund amount zeroed, no refund_requests row
      // created, status flipped to 'cancelled' + audit row.
      const { error } = await supabase.rpc('cancel_booking', {
        p_booking_id: parsed.data.bookingId,
        p_staff_override: false,
        p_refund_pct_override: null,
      })
      if (error) {
        const code = (error as { code?: string }).code
        if (code === '42501') return { ok: false, error: 'ไม่ใช่การจองของคุณ' }
        if (code === 'P0002') return { ok: false, error: 'ไม่พบการจองนี้' }
        if (code === 'P0001') {
          return {
            ok: false,
            error: 'การจองนี้ไม่อยู่ในสถานะที่สามารถยกเลิกได้',
          }
        }
        return {
          ok: false,
          error: 'ไม่สามารถยกเลิกการจองได้: ' + (error.message ?? 'unknown'),
        }
      }

      // 3. Best-effort: also call the canonical expire action to ensure
      //    the payments row is marked 'expired' (the Stripe API call
      //    above may have succeeded but the DB row needs a follow-up
      //    for any non-API observers).
      const expireRes = await expireCheckoutSessionAction({
        bookingId: parsed.data.bookingId,
      })
      if (!expireRes.ok) {
        console.warn(
          '[cancelUnpaidBookingAction] expireCheckoutSessionAction failed:',
          expireRes.error,
        )
      }
    } else {
      // status='pending' (legacy / no live path) or other non-cancellable
      // state — surface a clear error.
      return {
        ok: false,
        error: `การจองนี้อยู่ในสถานะ '${booking.status}' ที่ไม่สามารถยกเลิกด้วยตัวเองได้`,
      }
    }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถยกเลิกการจองได้')
  }

  // 4. Fire the cancellation_notice email (matches the existing
  //    `fireCancellationNotice` helper). Reuse it directly so the
  //    email template + audit pattern stays in one place.
  try {
    const { fireCancellationNotice } = await import('./booking')
    await fireCancellationNotice({ bookingId: parsed.data.bookingId })
  } catch (e) {
    console.error('[cancel_unpaid] cancellation_notice email failed:', e)
  }

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${parsed.data.bookingId}`)

  return { ok: true, data: { status: 'cancelled' } }
}
