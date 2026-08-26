'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { calculatePrice, generateBookingCode, DEFAULT_PRICING } from '@/lib/pricing'
import { quoteStay, violatesMinNights } from '@/lib/pricing/seasons'
import { getActiveSeasonalRatesForRange, getHotelSettings } from '@/lib/data/manager'
import { getDefaultCancellationPolicy } from '@/lib/data/bookings'

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
  markAsPaid: z.boolean().default(true),
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
    return { error: 'ข้อมูลไม่ถูกต้อง: ' + parsed.error.issues.map((i) => i.message).join(', ') }
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

  // Phase 12: live hotel_settings → tax + fee (mirror booking.ts).
  const hotelSettings = await getHotelSettings()
  const walkInSettings = hotelSettings
    ? {
        taxRate: Number(hotelSettings.tax_rate ?? DEFAULT_PRICING.taxRate),
        resortFeePerNight: Number(hotelSettings.resort_fee ?? DEFAULT_PRICING.resortFeePerNight),
      }
    : DEFAULT_PRICING

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
      return { error: 'ไม่สามารถสร้างบัญชีผู้เข้าพัก: ' + (createErr?.message ?? 'unknown') }
    }
    guestUserId = created.user.id
    // `handle_new_user()` trigger auto-creates the profile row.
  }

  // ── 5. Default cancellation policy + insert booking ──
  const policy = await getDefaultCancellationPolicy()
  const bookingCode = generateBookingCode()
  const { data: booking, error: insertErr } = await admin
    .from('bookings')
    .insert({
      booking_code: bookingCode,
      user_id: guestUserId,
      room_type_id: data.roomTypeId,
      check_in: data.checkIn,
      check_out: data.checkOut,
      guests: data.guests,
      nights: price.nights,
      base_subtotal: price.baseSubtotal,
      discount_total: price.discountTotal,
      tax_total: price.taxTotal,
      fee_total: price.feeTotal,
      total: price.total,
      currency: price.currency,
      cancellation_policy_id: policy?.id ?? null,
      status: 'confirmed',
      payment_status: data.markAsPaid ? 'paid' : 'unpaid',
      booker_full_name: data.bookerFullName,
      booker_email: data.bookerEmail,
      booker_phone: data.bookerPhone ?? null,
      special_request: data.specialRequest ?? null,
      channel: 'walk_in',
    })
    .select('id')
    .single()

  if (insertErr || !booking) {
    return { error: 'ไม่สามารถสร้างการจอง: ' + (insertErr?.message ?? 'unknown') }
  }

  revalidatePath('/reception/bookings')
  revalidatePath('/manager')
  return { success: true, bookingId: booking.id, userId: guestUserId }
}
