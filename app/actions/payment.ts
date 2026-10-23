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
import { openCheckoutSession } from '@/lib/payments/checkout'
import {
  createPaymentSession,
  updatePaymentSessionId,
} from '@/lib/data/payments'
import { getBookingPaymentStatus, getRefundMinDays, getRefundNotice } from '@/lib/data/bookings'
import { refundDeadlineOrNull } from '@/lib/refund-rule'
import { getServerT } from '@/lib/i18n/server'
import { formatDate, getTodayBangkok } from '@/lib/dates'
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
 *
 * Phase 52 follow-up — server-side re-validation BEFORE creating the
 * session:
 *   - booking owned by the caller
 *   - status='confirmed'|'temp_pending' + payment_status='unpaid'
 *   - lapsed_reason is NULL (not already expired)
 *   - payment_due_at > now() (Stage 1 or Stage 2 still alive)
 *   - has_capacity_for_booking(bookingId) returns true (defense in
 *     depth — the create_booking RPC is authoritative, but a slot
 *     could have been released by lazy-expiry between the read and
 *     this Pay click)
 *
 * Stage 2 trigger: after the Stripe session is created, extend
 * `bookings.payment_due_at` to now + 5 min. The Stripe session itself
 * must live ≥ 30 min (Stripe's floor), so the per-minute pg_cron job
 * closes it once the booking expires (see
 * lib/payments/close-expired-sessions.ts).
 */
/** Time the guest gets on the Stripe page after clicking Pay. */
const STAGE_2_MS = 5 * 60 * 1000

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

  // Phase 52 follow-up — server-side re-validation. The create_payment_session
  // RPC below also gates on some of these (owner, status, payment_status)
  // but doesn't check lapsed_reason or capacity. The precheck is the
  // single source of truth for the "can I open Stripe right now?" check.
  const sessionUser = await getSession()
  if (!sessionUser) {
    return { ok: false, error: 'กรุณาเข้าสู่ระบบ' }
  }
  const precheck = await precheckPayableBooking(
    parsed.data.bookingId,
    sessionUser.id,
  )
  if ('error' in precheck) {
    return { ok: false, error: precheck.error }
  }

  // Phase 57c — refund rule under the Stripe Pay button, in the guest's
  // language (same text + deadline as the booking form).
  const { locale, t } = await getServerT()
  const refundMinDays = await getRefundMinDays()
  const refundDeadline = refundDeadlineOrNull(precheck.checkIn, refundMinDays)
  const refundNote = refundDeadline
    ? t('customer.bookingForm.refundUntil', { date: formatDate(refundDeadline), min: refundMinDays })
    : t('customer.bookingForm.refundNone', { min: refundMinDays })

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

  // Phase 52 follow-up — Stage 2: 30-min Stripe session (Stripe's hard
  // floor). Coming back from Stripe and clicking Pay again reuses the
  // still-open session instead of opening a second one; see
  // lib/payments/checkout.ts for the reuse + idempotency-key rules.
  let opened
  try {
    opened = await openCheckoutSession(stripe, payment, {
      bookingId: parsed.data.bookingId,
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
      locale: locale === 'en' ? 'en' : 'th',
      custom_text: { submit: { message: refundNote } },
    })
  } catch (e) {
    return actionFail(e, 'Stripe error: ไม่สามารถเปิดหน้าชำระเงินได้')
  }

  if (opened.kind === 'already_paid') {
    return {
      ok: false,
      error: 'การชำระเงินนี้สำเร็จแล้ว ระบบกำลังอัปเดตสถานะ กรุณารีเฟรชหน้าอีกครั้งในอีกสักครู่',
    }
  }
  const session = opened.session
  if (!session.url) {
    return { ok: false, error: 'Stripe returned no checkout URL' }
  }
  // A reused session already has its id stored and the DB deadline extended.
  if (opened.kind === 'reused') {
    return { ok: true, data: { url: session.url } }
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

  // 4. Stage 2 — give the guest 5 min on the Stripe page. The session
  //    stays open longer (Stripe's 30-min floor) but is closed by the
  //    per-minute job once the booking expires. Best-effort: if the RPC
  //    fails, the booking is still payable; the worst case is the
  //    customer coming back to a freshly-expired row, which the
  //    `resetPaymentWindowAction` (called on `?cancelled=1`) would
  //    then re-open.
  try {
    const extendRes = await extendPaymentDeadlineAction({
      bookingId: parsed.data.bookingId,
      newPaymentDueAtIso: new Date(Date.now() + STAGE_2_MS).toISOString(),
    })
    if (!extendRes.ok) {
      console.warn(
        '[createCheckoutSessionAction] extendPaymentDeadlineAction failed:',
        extendRes.error,
      )
    }
  } catch (e) {
    console.warn(
      '[createCheckoutSessionAction] extendPaymentDeadlineAction threw:',
      e,
    )
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
      const { PaymentReceiptEmail, paymentReceiptSubject } = await import('@/lib/email/templates/payment-receipt')
      const { getRecipientLocale } = await import('@/lib/email/recipient-locale')
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = await createAdminClient()
      const { data: freshBooking } = await admin
        .from('bookings')
        .select('id, user_id, booking_code, booker_email, booker_full_name, total, currency, check_in')
        .eq('id', booking.id)
        .single()
      if (freshBooking) {
        const { data: payment } = await admin
          .from('payments')
          .select('id, amount, paid_at')
          .eq('booking_id', booking.id)
          .eq('status', 'succeeded')
          .order('paid_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (payment) {
          const { notifyUser } = await import('@/lib/notifications/notify')
          await notifyUser(freshBooking.user_id, {
            type: 'payment_received',
            params: { code: freshBooking.booking_code, amount: Number(payment.amount) },
            link: `/bookings/${freshBooking.id}`,
            bookingId: freshBooking.id,
            eventKey: `payment_received:${payment.id}`,
          })
        }
        if (payment && freshBooking.booker_email) {
          const emailLocale = await getRecipientLocale({ userId: freshBooking.user_id })
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
          await sendEmail({
            to: freshBooking.booker_email,
            template: 'payment_receipt',
            subject: paymentReceiptSubject({ bookingCode: freshBooking.booking_code, locale: emailLocale }),
            react: PaymentReceiptEmail({
              locale: emailLocale,
              bookingCode: freshBooking.booking_code,
              guestName: freshBooking.booker_full_name ?? '',
              amount: Number(payment.amount),
              currency: freshBooking.currency,
              method: 'cash',
              paidAt: payment.paid_at ?? new Date().toISOString(),
              viewUrl: `${appUrl}/bookings/${freshBooking.id}`,
              refund: await getRefundNotice(freshBooking.check_in),
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

// ============================================================================
// Phase 52 follow-up — Two-stage payment window
// ============================================================================

/**
 * Server-side re-validation before creating the Stripe Checkout Session.
 * Re-reads the booking (NOT just trusting the form payload) and checks:
 *   - booking is owned by the caller (RLS via createClient)
 *   - status is 'confirmed' (or 'temp_pending') + payment_status='unpaid'
 *   - lapsed_reason is NULL (i.e. not already expired)
 *   - payment_due_at > now() (Stage 1 or Stage 2 still alive)
 *   - has_capacity_for_booking(bookingId) returns true (defense in depth;
 *     the create_booking RPC is authoritative, but this catches a room
 *     that was released by another customer between lazy-expiry and
 *     this Pay click)
 *
 * Returns the localized error string on failure, or null on success.
 * Kept as a small helper so the same pre-checks can run in
 * createCheckoutSessionAction and (if needed) other places.
 */
async function precheckPayableBooking(
  bookingId: string,
  userId: string,
): Promise<{ error: string } | { checkIn: string }> {
  const supabase = await createClient()
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, user_id, status, payment_status, lapsed_reason, payment_due_at, check_in')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .maybeSingle()
  // A query error (e.g. a missing column when a migration wasn't applied)
  // is not "not found" — surface it instead of hiding it.
  if (error) {
    console.error('[precheckPayableBooking] failed to load booking:', error)
    return { error: `ไม่สามารถโหลดข้อมูลการจอง: ${error.message}` }
  }
  if (!booking) return { error: 'ไม่พบการจองนี้' }
  if (booking.status === 'cancelled') {
    return { error: 'การจองนี้ถูกยกเลิกแล้ว' }
  }
  if (
    booking.status !== 'confirmed' &&
    booking.status !== 'temp_pending'
  ) {
    return { error: 'การจองนี้ไม่อยู่ในสถานะที่ชำระเงินได้' }
  }
  if (booking.payment_status === 'paid') {
    return { error: 'การจองนี้ชำระเงินแล้ว' }
  }
  if (booking.payment_status !== 'unpaid') {
    return { error: 'การจองนี้ไม่อยู่ในสถานะที่ชำระเงินได้' }
  }
  if (booking.lapsed_reason !== null) {
    return { error: 'การจองนี้หมดเวลาชำระเงินแล้ว' }
  }
  if (
    booking.payment_due_at !== null &&
    new Date(booking.payment_due_at).getTime() <= Date.now()
  ) {
    return { error: 'การจองนี้หมดเวลาชำระเงินแล้ว' }
  }

  // Capacity re-check (defense in depth — the lazy-expiry on the read
  // path may not have run yet, so a just-released slot could still
  // appear occupied from the read side).
  const admin = await createAdminClient()
  const { data: hasCap } = await admin.rpc('has_capacity_for_booking', {
    p_booking_id: bookingId,
  })
  if (hasCap === false) {
    return { error: 'ห้องพักไม่ว่างในช่วงวันที่เลือก กรุณาเลือกห้องอื่น' }
  }

  return { checkIn: booking.check_in as string }
}

/**
 * Stage 2 — extend the DB payment deadline to match the Stripe
 * Checkout Session's `expires_at`. Called by createCheckoutSessionAction
 * after the session is created.
 *
 * Owner-checked at the action layer; the RPC also re-validates state.
 * Failure is non-fatal for the user — the booking is still payable, the
 * just-30-minute-window timer didn't sync to DB. The webhook's race
 * branch will handle any late deadline.
 */
export async function extendPaymentDeadlineAction(
  input: { bookingId: string; newPaymentDueAtIso: string },
): Promise<ActionResult> {
  const parsed = z
    .object({
      bookingId: z.string().regex(UUID_RE, 'bookingId must be a UUID'),
      newPaymentDueAtIso: z.string().datetime(),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }

  const session = await getSession()
  if (!session) {
    return { ok: false, error: 'กรุณาเข้าสู่ระบบ' }
  }

  const supabase = await createClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id')
    .eq('id', parsed.data.bookingId)
    .eq('user_id', session.id)
    .maybeSingle()
  if (!booking) {
    return { ok: false, error: 'ไม่พบการจองนี้' }
  }

  // Use admin client — the RPC grants EXECUTE to authenticated +
  // service_role but uses auth.uid() which is fine; the user-context
  // createClient should also work. Using admin keeps the column
  // RLS exception (writeable by RPCs only) consistent.
  const admin = await createAdminClient()
  const newDue = new Date(parsed.data.newPaymentDueAtIso)
  const { error } = await admin.rpc('extend_payment_due_at', {
    p_booking_id: parsed.data.bookingId,
    p_new_payment_due: newDue.toISOString(),
  })
  if (error) {
    return {
      ok: false,
      error: 'ไม่สามารถขยายเวลาชำระเงินได้: ' + translateSupabaseError(error.message),
    }
  }
  return { ok: true }
}

/**
 * Reset the 5-min payment window + un-expire the booking if needed.
 * Called server-side by /bookings/[id]?cancelled=1 when the customer
 * returns from Stripe without paying. Also expires any pending Stripe
 * session (best-effort) so the abandoned tab is closed.
 *
 * Fire-and-forget from the page server component — the response
 * renders the banner regardless of whether the reset succeeded; the
 * next read will trigger the lazy-expiry helper if a real deadline
 * actually lapsed.
 */
export type RetryExpiredBookingResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'room_taken' | 'dates_passed' | 'not_retryable' | 'error'; error: string }

/**
 * Phase 58 — "ทำรายการนี้อีกครั้ง" on a booking whose payment window ran out.
 * Re-opens the same booking (same code, dates and price) with a fresh
 * 5-minute window via reset_payment_window — which refuses with ROOM_TAKEN
 * when the slot was re-sold in the meantime (Phase 56) — then opens Stripe
 * through createCheckoutSessionAction. Only payment-deadline expiries can be
 * re-opened; a lapsed form hold or a past stay goes back to the room list.
 */
export async function retryExpiredBookingAction(
  input: { bookingId: string },
): Promise<RetryExpiredBookingResult> {
  const { t } = await getServerT()
  const parsed = z
    .object({ bookingId: z.string().regex(UUID_RE, 'bookingId must be a UUID') })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, reason: 'error', error: t('actions.common.invalidBookingId') }
  }

  const session = await getSession()
  if (!session) return { ok: false, reason: 'error', error: t('actions.common.notLoggedIn') }

  const supabase = await createClient()
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, payment_status, lapsed_reason, check_in')
    .eq('id', parsed.data.bookingId)
    .eq('user_id', session.id)
    .maybeSingle()
  if (error) return { ok: false, reason: 'error', error: error.message }
  if (!booking) return { ok: false, reason: 'error', error: t('actions.common.bookingNotFound') }

  if (
    booking.status !== 'expired' ||
    booking.payment_status !== 'unpaid' ||
    booking.lapsed_reason !== 'payment_deadline'
  ) {
    return { ok: false, reason: 'not_retryable', error: t('actions.payment.retryNotPossible') }
  }
  if (booking.check_in < getTodayBangkok()) {
    return { ok: false, reason: 'dates_passed', error: t('actions.payment.retryDatesPassed') }
  }

  const admin = await createAdminClient()
  const { error: resetErr } = await admin.rpc('reset_payment_window', {
    p_booking_id: parsed.data.bookingId,
  })
  if (resetErr) {
    if (resetErr.message.includes('ROOM_TAKEN')) {
      return { ok: false, reason: 'room_taken', error: t('actions.payment.retryRoomTaken') }
    }
    return { ok: false, reason: 'error', error: translateSupabaseError(resetErr.message) }
  }
  revalidatePath('/bookings')
  revalidatePath(`/bookings/${parsed.data.bookingId}`)

  const checkout = await createCheckoutSessionAction({ bookingId: parsed.data.bookingId })
  if (!checkout.ok) return { ok: false, reason: 'error', error: checkout.error }
  return { ok: true, url: checkout.data!.url }
}

export async function resetPaymentWindowAction(
  input: { bookingId: string },
): Promise<ActionResult<{ outcome: 'reset' | 'restored' | 'noop' }>> {
  const parsed = z
    .object({ bookingId: z.string().regex(UUID_RE, 'bookingId must be a UUID') })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }

  const session = await getSession()
  if (!session) {
    return { ok: false, error: 'กรุณาเข้าสู่ระบบ' }
  }

  const supabase = await createClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, status, payment_status, lapsed_reason')
    .eq('id', parsed.data.bookingId)
    .eq('user_id', session.id)
    .maybeSingle()
  if (!booking) {
    return { ok: false, error: 'ไม่พบการจองนี้' }
  }
  if (booking.payment_status !== 'unpaid') {
    // No-op: booking is already paid/cancelled/whatever.
    return { ok: true, data: { outcome: 'noop' } }
  }

  // 1. Expire any pending Stripe session (best-effort, same pattern
  //    as expireCheckoutSessionAction). The next Pay click will
  //    create a new session.
  const { data: payment } = await supabase
    .from('payments')
    .select('id, provider_session_id, status')
    .eq('booking_id', parsed.data.bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (
    payment &&
    payment.status === 'pending' &&
    payment.provider_session_id &&
    hasPaymentGateway &&
    stripe
  ) {
    try {
      await stripe.checkout.sessions.expire(payment.provider_session_id)
    } catch (e) {
      console.warn(
        '[resetPaymentWindowAction] stripe.expire failed:',
        e instanceof Error ? e.message : String(e),
      )
    }
  }

  // 2. Call the DB RPC. Service-role only, so use admin client.
  const admin = await createAdminClient()
  const { data, error } = await admin.rpc('reset_payment_window', {
    p_booking_id: parsed.data.bookingId,
  })
  if (error) {
    return {
      ok: false,
      error: 'ไม่สามารถรีเซ็ตเวลาชำระเงินได้: ' + translateSupabaseError(error.message),
    }
  }
  return {
    ok: true,
    data: { outcome: (data as 'reset' | 'restored' | null) ?? 'reset' },
  }
}

// ============================================================================
// Phase 52 — Stripe Checkout Session expiration (for unpaid-cancel flow)
// ============================================================================

const expireCheckoutSessionSchema = z.object({
  bookingId: z.string().regex(UUID_RE, 'bookingId must be a UUID'),
})

/**
 * Phase 52 — Expire the Stripe Checkout Session for an unpaid booking.
 *
 * Called by the leave-guard on /bookings/[id] when the customer confirms
 * "ยกเลิกรายการ" (cancel the booking) — we want the customer's abandoned
 * Stripe tab to be closed so they can't come back later and pay for a
 * booking we just cancelled. Without this, the Stripe tab would still be
 * live for up to 30 min (matches our DB `payment_due_at`), and the
 * `checkout.session.completed` webhook would race the cancel — auto-
 * refund logic in the webhook route handles that case, but proactively
 * expiring here is the cleaner path.
 *
 * Owner-checked: only the booking owner can call this. The Stripe
 * `sessions.expire` API is idempotent (returns the same session).
 *
 * Returns:
 *   - { ok: true } on both Stripe expire + DB expire success
 *   - { ok: true, warning: string } if Stripe call failed but DB flipped
 *     (the customer can't pay via the abandoned tab; webhook will
 *     auto-refund if it somehow lands)
 *   - { ok: false, error: string } on auth/validation failure
 *
 * Note: `expire_payment_session` RPC is service-role only — we use the
 * admin client here. RLS on `payments` would block the user-context
 * update anyway.
 */
export async function expireCheckoutSessionAction(
  input: { bookingId: string },
): Promise<ActionResult<{ expired: boolean }>> {
  const parsed = expireCheckoutSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }

  const session = await getSession()
  if (!session) {
    return { ok: false, error: 'กรุณาเข้าสู่ระบบ' }
  }

  const supabase = await createClient()

  // 1. Verify ownership + current state. The cancel-unpaid action calls
  //    this AFTER flipping bookings.status to 'cancelled', so we don't
  //    re-check status here — just ownership.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, status, payment_status')
    .eq('id', parsed.data.bookingId)
    .eq('user_id', session.id)
    .maybeSingle()
  if (!booking) {
    return { ok: false, error: 'ไม่พบการจองนี้' }
  }

  // 2. Find the latest pending payment row (the one that has the open
  //    Stripe session attached). If none, nothing to expire — return ok.
  const { data: payment } = await supabase
    .from('payments')
    .select('id, provider_session_id, status')
    .eq('booking_id', parsed.data.bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment || payment.status !== 'pending' || !payment.provider_session_id) {
    // No active Stripe session to expire (e.g. already paid, or never
    // opened a checkout). Return ok with expired:false so the caller
    // can proceed without surfacing an error.
    return { ok: true, data: { expired: false } }
  }

  // 3. Call Stripe API to expire the session (best-effort). If Stripe
  //    is misconfigured or the session is already gone, log and proceed
  //    to the DB flip — the webhook's auto-refund logic will catch any
  //    late-arriving checkout.session.completed event.
  let stripeOk = true
  let stripeError: string | null = null
  if (hasPaymentGateway && stripe) {
    try {
      await stripe.checkout.sessions.expire(payment.provider_session_id)
    } catch (e) {
      stripeOk = false
      stripeError = e instanceof Error ? e.message : String(e)
      console.warn(
        '[expireCheckoutSessionAction] stripe.expire failed:',
        stripeError,
      )
    }
  }

  // 4. Flip the payments row to 'expired' via the existing RPC.
  //    service-role only, so we use the admin client.
  const admin = await createAdminClient()
  try {
    await admin.rpc('expire_payment_session', {
      p_session_id: payment.provider_session_id,
      p_event_id: `manual-cancel:${parsed.data.bookingId}`,
    })
  } catch (e) {
    return {
      ok: false,
      error: 'ไม่สามารถอัปเดตสถานะการชำระเงินได้: ' +
        (e instanceof Error ? e.message : String(e)),
    }
  }

  if (!stripeOk) {
    // DB is in the right state; surface a non-fatal warning so the
    // caller can decide whether to retry or log.
    return {
      ok: true,
      data: { expired: true },
      ...(stripeError ? { warning: stripeError } : {}),
    } as ActionResult<{ expired: boolean }>
  }

  return { ok: true, data: { expired: true } }
}