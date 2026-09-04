'use server'

/**
 * Phase 20 #25 — Reception check-in / check-out server actions.
 *
 * The previous implementation was inline `supabase.from('bookings').update(...)`
 * inside the `CheckInOutActions` client component. That worked for the DB
 * write (staff RLS allows it) but blocked the Phase 25 email-infrastructure
 * layer — Resend needs server-side access to the API key + admin client to
 * capture the log row.
 *
 * Both actions here are thin: they read the booking, flip the status with the
 * same RLS-allowed UPDATE, audit via `booking_events`, then fire any
 * downstream email. Fire-and-forget semantics — an email failure must never
 * roll back the status flip.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { isUuid } from '@/lib/ids'
import { sendEmail } from '@/lib/email/resend'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const checkInSchema = z.object({
  bookingId: z.string().refine(isUuid, 'bookingId must be a UUID'),
  roomUnitId: z.string().refine(isUuid, 'roomUnitId must be a UUID'),
})

const checkOutSchema = z.object({
  bookingId: z.string().refine(isUuid, 'bookingId must be a UUID'),
})

/**
 * Check a guest in. Assigns the selected physical `room_unit_id` and flips
 * `bookings.status` from `confirmed` → `checked_in`. Validates the booking
 * exists + is in a check-in-eligible status before mutating.
 *
 * audit row + housekeeping task creation are deferred to the existing
 * downstream trigger / data layer.
 */
export async function checkInBookingAction(
  input: { bookingId: string; roomUnitId: string },
): Promise<ActionResult> {
  const session = await requireRole(['reception', 'manager', 'admin'], '/reception')
  const parsed = checkInSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }

  const supabase = await createClient()

  try {
    const { data: booking, error: readErr } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', parsed.data.bookingId)
      .maybeSingle()
    if (readErr) throw readErr
    if (!booking) return { ok: false, error: 'ไม่พบการจอง' }
    if (booking.status !== 'confirmed') {
      return { ok: false, error: 'สถานะการจองไม่อยู่ในสถานะที่พร้อมเช็คอิน' }
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'checked_in', room_unit_id: parsed.data.roomUnitId })
      .eq('id', parsed.data.bookingId)
    if (updateErr) throw updateErr

    // Audit row (the original client-component path skipped this — Phase 25
    // closes that gap so the booking timeline shows who checked the guest in).
    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: parsed.data.bookingId,
      actor_id: session.id,
      actor_role: session.role,
      event_type: 'checked_in',
      description: 'Guest checked in',
      metadata: { room_unit_id: parsed.data.roomUnitId },
    })

    revalidatePath('/reception/check-in-out')
    revalidatePath('/reception')
    revalidatePath('/manager')
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถเช็คอินได้')
  }
}

/**
 * Check a guest out. Flips `bookings.status` from `checked_in` → `checked_out`
 * (room_unit_id stays — useful for housekeeping dispatch).
 *
 * Fires the `checkout_thank_you` email after the DB flip succeeds. If Resend
 * is down, the email_log row records status='failed' for replay from the
 * manager dashboard. The audit row records the actor + timing.
 */
export async function checkOutBookingAction(
  input: { bookingId: string },
): Promise<ActionResult> {
  const session = await requireRole(['reception', 'manager', 'admin'], '/reception')
  const parsed = checkOutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }

  const supabase = await createClient()

  try {
    const { data: booking, error: readErr } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', parsed.data.bookingId)
      .maybeSingle()
    if (readErr) throw readErr
    if (!booking) return { ok: false, error: 'ไม่พบการจอง' }
    if (booking.status !== 'checked_in') {
      return { ok: false, error: 'สถานะการจองไม่อยู่ในสถานะที่พร้อมเช็คเอาท์' }
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'checked_out' })
      .eq('id', parsed.data.bookingId)
    if (updateErr) throw updateErr

    // Audit row + thank-you email. Capture nights_stayed from the booking
    // record for the template body.
    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: parsed.data.bookingId,
      actor_id: session.id,
      actor_role: session.role,
      event_type: 'checked_out',
      description: 'Guest checked out',
    })

    // Load the minimal booking fields the template needs. Fresh admin read
    // so we don't depend on the booking row still being in cache after the
    // revalidate-cycle kick-off below.
    try {
      const { data: fullBooking } = await admin
        .from('bookings')
        .select('id, booking_code, booker_email, booker_full_name, check_in, check_out, nights, total, currency')
        .eq('id', parsed.data.bookingId)
        .single()
      if (fullBooking && fullBooking.booker_email) {
        const { CheckoutThankYouEmail } = await import(
          '@/lib/email/templates/checkout-thank-you'
        )
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        await sendEmail({
          to: fullBooking.booker_email,
          template: 'checkout_thank_you',
          subject: `[Zenzero] ขอบคุณที่เข้าพัก — ${fullBooking.booking_code}`,
          react: CheckoutThankYouEmail({
            bookingCode: fullBooking.booking_code,
            guestName: fullBooking.booker_full_name ?? '',
            nightsStayed: fullBooking.nights ?? 0,
            total: Number(fullBooking.total ?? 0),
            currency: fullBooking.currency ?? 'THB',
            reviewUrl: `${appUrl}/bookings/${fullBooking.id}`,
          }),
          eventKey: `checkout_thank_you:booking:${fullBooking.id}`,
          bookingId: fullBooking.id,
          metadata: { actor_id: session.id, channel: 'reception' },
        })
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[checkout_thank_you] email dispatch failed:', e)
    }

    revalidatePath('/reception/check-in-out')
    revalidatePath('/reception')
    revalidatePath('/manager')
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถเช็คเอาท์ได้')
  }
}
