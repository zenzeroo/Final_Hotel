'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePrice, generateBookingCode } from '@/lib/pricing'
import { quoteStay, violatesMinNights } from '@/lib/pricing/seasons'
import { getActiveSeasonalRatesForRange, getPricingConstants } from '@/lib/data/manager'
import { getDefaultCancellationPolicy, getPromotionByCode } from '@/lib/data/bookings'
import { translateSupabaseError, translateZodIssues } from '@/lib/errors/translate'
import { isUuid } from '@/lib/ids'
import { requireRole } from '@/lib/auth/require'

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

  // Phase 20 #23 — server action delegates the atomic insert + capacity check
  // to the `create_booking` SECURITY DEFINER RPC. The RPC acquires a FOR
  // UPDATE lock on the room_units pool for this room_type_id, counts slot-
  // occupying bookings overlapping the date range, and throws P0001 when the
  // pool is exhausted. Auth remains the server action's responsibility — the
  // RPC trusts the caller (GRANT includes authenticated + service_role).
  const bookingCode = generateBookingCode()
  const { data: bookingId, error: rpcError } = await supabase.rpc('create_booking', {
    p_user_id: user.id,
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
    p_promotion_id: promotion?.id ?? null,
    p_cancellation_policy_id: policy?.id ?? null,
    p_booker_full_name: data.bookerFullName,
    p_booker_email: data.bookerEmail,
    p_booker_phone: data.bookerPhone ?? null,
    p_special_request: data.specialRequest ?? null,
    p_channel: 'web',
    p_booking_code: bookingCode,
  })

  if (rpcError || !bookingId) {
    // P0001 = pool exhausted / no active rooms of this type
    if (rpcError?.code === 'P0001') {
      return {
        error: 'ห้องพักประเภทนี้ไม่ว่างในช่วงวันที่เลือก กรุณาเลือกวันอื่นหรือประเภทอื่น',
      }
    }
    return { error: 'ไม่สามารถสร้างการจอง: ' + translateSupabaseError(rpcError?.message) }
  }

  revalidatePath('/bookings')
  return { success: true, bookingId }
}

/**
 * Cancel a booking (sets status to 'cancelled').
 *
 * Phase 20 #24 — atomic via the `cancel_booking` SECURITY DEFINER RPC.
 * The RPC enforces the linked cancellation_policy (`free_cancel_hours`
 * + `refund_pct`), flips booking status, and inserts a `refund_requests`
 * row when the caller has paid AND the refund amount > 0 (manager then
 * reviews + approves via the existing /manager/bookings flow).
 *
 * Return shape now includes the computed refund_amount + penalty_amount
 * so the UI can show "คุณจะได้รับเงินคืน X บาท เสียค่าธรรมเนียม Y บาท"
 * per the contractually-applied policy.
 */
export interface CancelBookingResult {
  success?: boolean
  error?: string
  refundAmount?: number   // amount that will be refunded (0 if no refund row created)
  penaltyAmount?: number  // total - refundAmount
  policyName?: string     // applied policy (e.g. "Flexible", "Strict")
  refundRequestId?: string | null  // null when no refund row created (unpaid / penalty=0)
}

export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  if (!isUuid(bookingId)) return { error: 'รหัสการจองไม่ถูกต้อง' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_staff_override: false,
    p_refund_pct_override: null,
  })

  if (error) {
    // P0001 = state guard (already cancelled / past check-in / no policy)
    // P0002 = booking not found
    // 42501 = authorization (other user's booking)
    const code = (error as { code?: string }).code
    if (code === 'P0001') {
      return { error: 'ไม่สามารถยกเลิกการจองนี้ได้: ' + translateSupabaseError(error.message) }
    }
    if (code === 'P0002') {
      return { error: 'ไม่พบการจองนี้' }
    }
    return { error: 'ไม่สามารถยกเลิกการจอง: ' + translateSupabaseError(error.message) }
  }

  const row = Array.isArray(data) ? data[0] : data
  const refundAmount = row ? Number(row.refund_amount) : 0
  const penaltyAmount = row ? Number(row.penalty_amount) : 0
  const policyName = row?.policy_name ?? ''
  const refundRequestId = row?.refund_request_id ?? null

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath('/manager/bookings')
  return {
    success: true,
    refundAmount,
    penaltyAmount,
    policyName,
    refundRequestId,
  }
}

/**
 * Phase 20 #24 — staff-initiated cancellation (reception / manager / admin).
 *
 * Lets a staff member cancel a booking on behalf of a guest (e.g. walk-in
 * reversal, complaint handling) and optionally override the policy's
 * `refund_pct` (manager/admin only). The same atomic `cancel_booking` RPC
 * is used; the override flag + numeric refund_pct pass through.
 *
 * - `refundPctOverride=null` → apply the policy as-is (respect free window).
 * - `refundPctOverride=100`  → 100% goodwill refund (manager/admin only).
 * - `refundPctOverride=0`    → keep full charge but still flip status.
 *
 * The RPC authorizes the override inside its body via `has_role` — the
 * server action also gates on `requireRole` for defense-in-depth.
 */
export async function cancelBookingByStaff(
  bookingId: string,
  refundPctOverride: number | null = null,
): Promise<CancelBookingResult> {
  if (!isUuid(bookingId)) return { error: 'รหัสการจองไม่ถูกต้อง' }

  // requireRole redirects on auth failure — only manager/admin reach the
  // override block below. Reception can still cancel without override.
  const session = await requireRole(
    ['reception', 'manager', 'admin'],
    '/reception',
  )

  if (refundPctOverride !== null) {
    if (session.role !== 'manager' && session.role !== 'admin') {
      return { error: 'เฉพาะผู้จัดการหรือผู้ดูแลระบบเท่านั้นที่สามารถปรับเปอร์เซ็นต์คืนเงินได้' }
    }
    if (refundPctOverride < 0 || refundPctOverride > 100) {
      return { error: 'เปอร์เซ็นต์คืนเงินต้องอยู่ระหว่าง 0 ถึง 100' }
    }
  }

  const admin = await createAdminClient()
  const { data, error } = await admin.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_staff_override: true,
    p_refund_pct_override: refundPctOverride,
  })

  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'P0001') {
      return { error: 'ไม่สามารถยกเลิกการจองนี้ได้: ' + translateSupabaseError(error.message) }
    }
    if (code === 'P0002') {
      return { error: 'ไม่พบการจองนี้' }
    }
    return { error: 'ไม่สามารถยกเลิกการจอง: ' + translateSupabaseError(error.message) }
  }

  const row = Array.isArray(data) ? data[0] : data
  const refundAmount = row ? Number(row.refund_amount) : 0
  const penaltyAmount = row ? Number(row.penalty_amount) : 0
  const policyName = row?.policy_name ?? ''
  const refundRequestId = row?.refund_request_id ?? null

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath('/reception/bookings')
  revalidatePath('/manager/bookings')
  return {
    success: true,
    refundAmount,
    penaltyAmount,
    policyName,
    refundRequestId,
  }
}
