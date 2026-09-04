'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { calculatePrice, generateBookingCode } from '@/lib/pricing'
import { quoteStay, violatesMinNights } from '@/lib/pricing/seasons'
import { getActiveSeasonalRatesForRange, getPricingConstants } from '@/lib/data/manager'
import { getDefaultCancellationPolicy } from '@/lib/data/bookings'
import { translateSupabaseError, translateZodIssues } from '@/lib/errors/translate'
import { sendEmail } from '@/lib/email/resend'

/**
 * Phase 12 — Walk-in booking server action.
 *
 * Called from `app/reception/bookings/new/create/WalkInForm.tsx`.
 *
 * Difference from `createBooking`:
 *   - The guest has NO `auth.users` row yet, so RLS `bookings self-insert`
 *     (which requires `user_id = auth.uid()`) would reject the insert.
 *   - This action uses the SERVICE ROLE client to (a) find or create the
 *     guest's auth user, (b) insert the booking with `channel='walk_in'`.
 *   - Authorisation: the caller (reception staff) must be authenticated and
 *     have role `reception` / `manager` / `admin`. We re-verify via
 *     `createClient()` (cookie-based) before doing anything.
 */
const walkInSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(10),
  bookerFullName: z.string().min(1).max(120),
  bookerEmail: z.string().email(),
  bookerPhone: z.string().max(40).optional().nullable(),
  specialRequest: z.string().max(500).optional().nullable(),
  promoCode: z.string().max(40).optional().nullable(),
  // Phase 17 — replaces the boolean `markAsPaid`. `card` will redirect to
  // Stripe Checkout via `createCheckoutSessionAction` from the form layer.
  paymentMethod: z.enum(['cash', 'card', 'unpaid']).default('cash'),
})

export type WalkInBookingInput = z.infer<typeof walkInSchema>

export interface WalkInBookingResult {
  success?: boolean
  error?: string
  bookingId?: string
  userId?: string
}

export async function createWalkInBooking(input: WalkInBookingInput): Promise<WalkInBookingResult> {
  const parsed = walkInSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'ข้อมูลไม่ถูกต้อง: ' + translateZodIssues(parsed.error.issues) }
  }
  const data = parsed.data

  // ── 1. Verify caller is staff (reception / manager / admin) ──
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { error: 'กรุณาเข้าสู่ระบบ' }

  // Caller's role lives in profiles; we read directly to avoid a recursive RLS trap.
  const { data: callerProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (profileErr || !callerProfile) return { error: 'ไม่พบข้อมูลผู้ใช้' }
  if (!['reception', 'manager', 'admin'].includes(callerProfile.role)) {
    return { error: 'ต้องเป็นเจ้าหน้าที่ (reception/manager/admin) เท่านั้น' }
  }

  // ── 2. Validate room + dates (same logic as createBooking) ──
  const { data: room, error: roomErr } = await supabase
    .from('room_types')
    .select('base_price, max_guests, is_active')
    .eq('id', data.roomTypeId)
    .maybeSingle()
  if (roomErr || !room) return { error: 'ไม่พบห้องพัก' }
  if (!room.is_active) return { error: 'ห้องพักนี้ไม่พร้อมใช้งาน' }
  if (data.guests > room.max_guests) {
    return { error: `ห้องนี้รองรับผู้เข้าพักสูงสุด ${room.max_guests} ท่าน` }
  }
  if (data.checkIn >= data.checkOut) {
    return { error: 'วันที่เช็คเอาท์ต้องมาหลังวันเช็คอิน' }
  }
  // Walk-in allows same-day check-in (no past-date guard needed).

  // ── 3. Seasonal quote + price (same logic as createBooking) ──
  const seasonalRates = await getActiveSeasonalRatesForRange({
    roomTypeId: data.roomTypeId,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
  })
  let quote
  try {
    quote = quoteStay({
      roomTypeId: data.roomTypeId,
      basePrice: room.base_price,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      rates: seasonalRates,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'วันที่ไม่ถูกต้อง' }
  }
  if (violatesMinNights(quote, seasonalRates)) {
    return {
      error: 'การจองนี้ต้องพักขั้นต่ำตามที่กำหนดในเรทฤดูกาล',
    }
  }

  // Live tax + resort fee come from hotel_settings via getPricingConstants
  // (same helper used by createBooking in app/actions/booking.ts).
  const walkInSettings = await getPricingConstants()

  const price = calculatePrice({
    basePrice: room.base_price,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    guests: data.guests,
    promotion: null,
    quote,
  }, walkInSettings)
  if (price.nights === 0) return { error: 'จำนวนคืนต้องมากกว่า 0' }

  // ── 4. Find or create the guest's auth user via SERVICE ROLE ──
  const admin = await createAdminClient()
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', data.bookerEmail)
    .maybeSingle()

  let guestUserId: string
  if (existingProfile) {
    guestUserId = existingProfile.id
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: data.bookerEmail,
      email_confirm: true,
      user_metadata: {
        full_name: data.bookerFullName,
        phone: data.bookerPhone ?? null,
      },
    })
    if (createErr || !created.user) {
      return { error: 'ไม่สามารถสร้างบัญชีผู้เข้าพัก: ' + translateSupabaseError(createErr?.message) }
    }
    guestUserId = created.user.id
    // `handle_new_user()` trigger auto-creates the profile row.
  }

  // ── 5. Default cancellation policy + atomic booking insert via RPC ──
  // Phase 20 #23 — the RPC enforces overbooking prevention (capacity check
  // under FOR UPDATE lock on the room_units pool). For walk-in we use the
  // service-role admin client; the RPC grants EXECUTE to service_role for
  // this reason. Auth check is the server action's responsibility (already
  // done at step 1).
  //
  // The RPC always inserts with payment_status='unpaid'. The cash flow below
  // flips it to 'paid' + records a `payments` row after the RPC returns.
  const policy = await getDefaultCancellationPolicy()
  const bookingCode = generateBookingCode()
  const { data: bookingId, error: rpcError } = await admin.rpc('create_booking', {
    p_user_id: guestUserId,
    p_room_type_id: data.roomTypeId,
    p_check_in: data.checkIn,
    p_check_out: data.checkOut,
    p_guests: data.guests,
    p_nights: price.nights,
    p_base_subtotal: price.baseSubtotal,
    p_discount_total: price.discountTotal,
    p_tax_total: price.taxTotal,
    p_fee_total: price.feeTotal,
    p_total: price.total,
    p_currency: price.currency,
    p_promotion_id: null,  // walk-in doesn't accept promo codes
    p_cancellation_policy_id: policy?.id ?? null,
    p_booker_full_name: data.bookerFullName,
    p_booker_email: data.bookerEmail,
    p_booker_phone: data.bookerPhone ?? null,
    p_special_request: data.specialRequest ?? null,
    p_channel: 'walk_in',
    p_booking_code: bookingCode,
  })

  if (rpcError || !bookingId) {
    // P0001 = pool exhausted / no active rooms of this type
    if (rpcError?.code === 'P0001') {
      return {
        error: 'ห้องพักไม่ว่างในช่วงวันที่เลือก กรุณาเลือกวันอื่นหรือประเภทอื่น',
      }
    }
    return { error: 'ไม่สามารถสร้างการจอง: ' + translateSupabaseError(rpcError?.message) }
  }

  // Phase 17 — for cash walk-ins, flip payment_status to 'paid' AND record
  // a payments row so the accounting path is uniform with Stripe-originated
  // payments (manager dashboard sums `payments.amount` regardless of
  // provider). Card/unpaid stay 'unpaid' until Stripe webhook confirms.
  if (data.paymentMethod === 'cash') {
    const { error: payErr } = await admin.from('payments').insert({
      booking_id: bookingId,
      provider: 'cash',
      payment_method: 'cash',
      amount: price.total,
      currency: price.currency,
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      metadata: {
        actor_id: caller.id,
        actor_role: callerProfile.role,
      },
    })
    if (payErr) {
      // Don't fail the whole booking — booking row exists, payments row is
      // audit-only. Log and continue.
      console.warn('[walk-in] failed to insert cash payment row:', payErr.message)
    } else {
      // Flip booking.payment_status to 'paid' so the UI matches the cash
      // receipt. The RPC always writes 'unpaid'; the original inline-insert
      // path used to write 'paid' directly.
      const { error: updateErr } = await admin
        .from('bookings')
        .update({ payment_status: 'paid' })
        .eq('id', bookingId)
      if (updateErr) {
        console.warn('[walk-in] failed to flip booking payment_status:', updateErr.message)
      }
    }
  }

  revalidatePath('/reception/bookings')
  revalidatePath('/manager')

  // Phase 20 #25 — booking_confirmation email for walk-in too. The guest
  // may have provided a bookerEmail (walk-in is sometimes pre-paid online
  // by a third party). Fire-and-forget.
  try {
    const { data: booking } = await admin
      .from('bookings')
      .select('id, booking_code, check_in, check_out, nights, total, currency, booker_email, booker_full_name, room_type:room_types(name), payment_status')
      .eq('id', bookingId)
      .single()
    if (booking && data.bookerEmail) {
      const roomTypeName = (booking.room_type as { name?: string } | null)?.name ?? 'ห้องพัก'
      const { BookingConfirmationEmail } = await import('@/lib/email/templates/booking-confirmation')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await sendEmail({
        to: data.bookerEmail,
        template: 'booking_confirmation',
        subject: `[Zenzero] ยืนยันการจอง ${booking.booking_code} — ${booking.check_in}`,
        react: BookingConfirmationEmail({
          bookingCode: booking.booking_code,
          guestName: booking.booker_full_name ?? '',
          roomTypeName,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          nights: booking.nights ?? 0,
          total: Number(booking.total),
          currency: booking.currency,
          viewUrl: `${appUrl}/bookings/${booking.id}`,
        }),
        eventKey: `booking_confirmation:booking:${booking.id}`,
        bookingId: booking.id,
        metadata: { channel: 'walk_in', payment_method: data.paymentMethod },
      })
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[walk-in booking_confirmation] email dispatch failed:', e)
  }

  return { success: true, bookingId, userId: guestUserId }
}
