'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { calculatePrice, generateBookingCode } from '@/lib/pricing'
import { quoteStay, violatesMinNights } from '@/lib/pricing/seasons'
import { getActiveSeasonalRatesForRange, getPricingConstants } from '@/lib/data/manager'
import { getDefaultCancellationPolicy, getPromotionByCode } from '@/lib/data/bookings'
import { translateSupabaseError, translateZodIssues } from '@/lib/errors/translate'

const createBookingSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(10),
  bookerFullName: z.string().min(1).max(120),
  bookerEmail: z.string().email(),
  bookerPhone: z.string().max(40).optional().nullable(),
  specialRequest: z.string().max(500).optional().nullable(),
  promoCode: z.string().max(40).optional().nullable(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

export interface CreateBookingResult {
  success?: boolean
  error?: string
  bookingId?: string
}

/**
 * Create a new booking (and redirect to confirmation).
 * Validates: dates, room availability, prices, user profile.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'ข้อมูลไม่ถูกต้อง: ' + translateZodIssues(parsed.error.issues) }
  }

  const data = parsed.data
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  // Get room
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

  // Validate dates
  if (data.checkIn >= data.checkOut) {
    return { error: 'วันที่เช็คเอาท์ต้องมาหลังวันเช็คอิน' }
  }
  const today = new Date().toISOString().slice(0, 10)
  if (data.checkIn < today) {
    return { error: 'วันที่เช็คอินต้องไม่เป็นอดีต' }
  }

  // Get promotion (if any)
  let promotion = null
  if (data.promoCode) {
    promotion = await getPromotionByCode(data.promoCode)
    if (!promotion) return { error: 'รหัสโปรโมชั่นไม่ถูกต้อง' }
  }

  // Get default cancellation policy
  const policy = await getDefaultCancellationPolicy()

  // Phase 8 — fetch seasonal rates for this room type and compute per-night quote.
  // Falls back to base_price for all nights if no active rates match.
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

  // Enforce min_nights_override on any applied seasonal rate.
  if (violatesMinNights(quote, seasonalRates)) {
    return {
      error: 'การจองนี้ต้องพักขั้นต่ำตามที่กำหนดในเรทฤดูกาล (ดูรายละเอียดเรทพิเศษ)',
    }
  }

  // Calculate price (Phase 8 path — baseSubtotal comes from the quote).
  // Live tax + resort fee come from hotel_settings via getPricingConstants,
  // which falls back to DEFAULT_PRICING (0.07 / 150) when the singleton row
  // is missing.
  const pricingSettings = await getPricingConstants()
  const price = calculatePrice({
    basePrice: room.base_price,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    guests: data.guests,
    promotion: promotion
      ? {
          code: promotion.code,
          discountType: promotion.discount_type,
          discountValue: promotion.discount_value,
          minNights: promotion.min_nights,
        }
      : null,
    quote,
  }, pricingSettings)

  if (price.nights === 0) {
    return { error: 'จำนวนคืนต้องมากกว่า 0' }
  }

  // Insert booking
  const bookingCode = generateBookingCode()
  const { data: booking, error: insertErr } = await supabase
    .from('bookings')
    .insert({
      booking_code: bookingCode,
      user_id: user.id,
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
      promotion_id: promotion?.id ?? null,
      cancellation_policy_id: policy?.id ?? null,
      status: 'confirmed',
      payment_status: 'unpaid',
      booker_full_name: data.bookerFullName,
      booker_email: data.bookerEmail,
      booker_phone: data.bookerPhone ?? null,
      special_request: data.specialRequest ?? null,
      channel: 'web',
    })
    .select('id')
    .single()

  if (insertErr || !booking) {
    return { error: 'ไม่สามารถสร้างการจอง: ' + translateSupabaseError(insertErr?.message) }
  }

  revalidatePath('/bookings')
  return { success: true, bookingId: booking.id }
}

/**
 * Mark a booking as paid (stub — no real payment gateway).
 */
export async function markPaid(bookingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const { error } = await supabase
    .from('bookings')
    .update({ payment_status: 'paid' })
    .eq('id', bookingId)
    .eq('user_id', user.id)

  if (error) return { error: 'ไม่สามารถอัปเดตการชำระเงิน: ' + translateSupabaseError(error.message) }

  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath('/bookings')
  return { success: true }
}

/**
 * Cancel a booking (sets status to 'cancelled').
 */
export async function cancelBooking(bookingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', user.id)

  if (error) return { error: 'ไม่สามารถยกเลิกการจอง: ' + translateSupabaseError(error.message) }

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  return { success: true }
}
