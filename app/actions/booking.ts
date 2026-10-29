'use server'

import { getServerT } from '@/lib/i18n/server'
import { getT } from '@/lib/i18n/t'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refundDeadlineIso } from '@/lib/refund-rule'
import { acceptRefundRuleSchema } from '@/lib/validation/refund-rule'
import { calculatePrice, calculateNights, generateBookingCode } from '@/lib/pricing'
import { getTodayBangkok } from '@/lib/dates'
import { quoteStay, violatesMinNights } from '@/lib/pricing/seasons'
import { getActiveSeasonalRatesForRange, getPricingConstants } from '@/lib/data/manager'
import { getDefaultCancellationPolicy, getPromotionByCode, getRefundMinDays, getRefundNotice } from '@/lib/data/bookings'
import { translateSupabaseError, translateZodIssues } from '@/lib/errors/translate'
import { isUuid } from '@/lib/ids'
import type { RoomTypeName } from '@/lib/data/types'
import { requireRole } from '@/lib/auth/require'
import { sanitizeNext } from '@/lib/auth/sanitize'
import { needsConsent } from '@/lib/consent'
import { getCurrentConsentVersion } from '@/lib/data/legal'
import type { UserRole } from '@/lib/supabase/roles'
import { sendEmail } from '@/lib/email/resend'
import { getRecipientLocale } from '@/lib/email/recipient-locale'
import { notifyRoles, notifyUser } from '@/lib/notifications/notify'

const createBookingSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(10),
  bookerFullName: z.string().min(1).max(120),
  // Phase 51 — bookerEmail is no longer accepted from the client.
  // The session email is derived from auth.getUser() in the action body
  // and passed straight to the RPC, which also re-derives it (defense
  // in depth). Walk-in flow (service_role) still uses bookerEmail via
  // a separate schema in app/actions/walk-in-booking.ts.
  bookerPhone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'validation.phone10'),
  specialRequest: z.string().max(500).optional().nullable(),
  promoCode: z.string().max(40).optional().nullable(),
  // Phase 57c — the guest must tick "I accept the refund policy".
  acceptRefundRule: acceptRefundRuleSchema,
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

export interface CreateBookingResult {
  success?: boolean
  error?: string
  bookingId?: string
}

/**
 * Phase 61 — a customer who has not accepted the current terms + privacy
 * notice cannot book. Send them to /consent and back to the page they
 * booked from (the Referer). The proxy does the same for page loads; this
 * covers actions fired from ungated pages such as /rooms/[id].
 */
async function redirectIfConsentMissing(
  profile: { role?: string | null; terms_version?: string | null } | null,
): Promise<void> {
  if (!profile) return
  const role = (profile.role ?? 'user') as UserRole
  const current = await getCurrentConsentVersion()
  if (!needsConsent({ role, termsVersion: profile.terms_version ?? null }, current)) return
  let next = '/'
  const referer = (await headers()).get('referer')
  if (referer) {
    try {
      const url = new URL(referer)
      next = url.pathname + url.search
    } catch {
      // keep '/'
    }
  }
  redirect(`/consent?next=${encodeURIComponent(sanitizeNext(next))}`)
}

/**
 * Create a new booking (and redirect to confirmation).
 * Validates: dates, room availability, prices, user profile.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { locale, t } = await getServerT()
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: t('actions.common.invalidInput', { detail: translateZodIssues(parsed.error.issues, locale) }) }
  }

  const data = parsed.data
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: t('actions.common.notLoggedIn') }

  // Phase 51 — derive the booking email from the authenticated account.
  // The form no longer collects email (it's read-only on the customer
  // BookingForm, bound to the account). The RPC also re-derives it for
  // defense in depth.
  const sessionEmail = user.email ?? ''
  if (!sessionEmail) {
    return {
      error:
        t('actions.common.noAccountEmail'),
    }
  }

  // Phase 36 — block suspended customers from booking. App-layer guard
  // (per CLAUDE.md zenzero-rls-recursion-fix) because Supabase auth itself
  // doesn't read profiles and inline EXISTS-on-profiles triggers 42P17.
  const { data: customerProfile } = await supabase
    .from('profiles')
    .select('is_suspended, role, terms_version')
    .eq('id', user.id)
    .maybeSingle()
  if (customerProfile?.is_suspended) {
    return { error: t('actions.common.suspended') }
  }
  await redirectIfConsentMissing(customerProfile)

  // Get room
  const { data: room, error: roomErr } = await supabase
    .from('room_types')
    .select('base_price, max_guests, is_active, type')
    .eq('id', data.roomTypeId)
    .maybeSingle()

  if (roomErr || !room) return { error: t('actions.common.roomNotFound') }
  if (!room.is_active) return { error: t('actions.common.roomInactive') }
  if (data.guests > room.max_guests) {
    return { error: t('actions.common.maxGuests', { max: room.max_guests }) }
  }

  // Validate dates
  if (data.checkIn >= data.checkOut) {
    return { error: t('actions.common.checkoutAfterCheckin') }
  }
  // Phase 49 — use Bangkok-TZ "today" (not UTC) so Bangkok users at
  // 00:00-06:59 don't get yesterday's date. Same-day check-in IS
  // allowed — only past dates are rejected.
  const today = getTodayBangkok()
  if (data.checkIn < today) {
    return { error: t('actions.common.checkinNotPast') }
  }

  // Get promotion (if any)
  let promotion = null
  if (data.promoCode) {
    promotion = await getPromotionByCode(data.promoCode)
    if (!promotion) return { error: t('actions.common.promoInvalid') }
    // Phase 27 — room-type scoping. applies_to_room_types === null/[] =
    // applies to all room types (backwards-compatible). Non-empty =
    // reject when the booking's room type isn't in the list.
    if (
      promotion.applies_to_room_types &&
      promotion.applies_to_room_types.length > 0 &&
      !promotion.applies_to_room_types.includes(room.type as RoomTypeName)
    ) {
      return { error: t('actions.common.promoNotForRoom') }
    }
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
    return { error: err instanceof Error ? err.message : t('actions.common.invalidDate') }
  }

  // Enforce min_nights_override on any applied seasonal rate.
  if (violatesMinNights(quote, seasonalRates)) {
    return {
      error: t('actions.common.minNights'),
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
          maxDiscountAmount: promotion.max_discount_amount ?? null,
        }
      : null,
    quote,
  }, pricingSettings)

  if (price.nights === 0) {
    return { error: t('actions.common.nightsPositive') }
  }

  // Phase 20 #23 — server action delegates the atomic insert + capacity check
  // to the `create_booking` SECURITY DEFINER RPC. The RPC acquires a FOR
  // UPDATE lock on the room_units pool for this room_type_id, counts slot-
  // occupying bookings overlapping the date range, and throws P0001 when the
  // pool is exhausted. The RPC stores the price, channel and user id as
  // given, so only service_role may call it (20261022): auth + pricing stay
  // here, and the guest's own JWT cannot reach it through PostgREST.
  const bookingCode = generateBookingCode()
  const admin = await createAdminClient()
  const { data: bookingId, error: rpcError } = await admin.rpc('create_booking', {
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
    p_booker_email: sessionEmail,
    p_booker_phone: data.bookerPhone,
    p_special_request: data.specialRequest ?? null,
    p_channel: 'web',
    p_booking_code: bookingCode,
  })

  if (rpcError || !bookingId) {
    // P0001 = pool exhausted / no active rooms of this type
    if (rpcError?.code === 'P0001') {
      return {
        error: t('actions.common.roomSoldOut'),
      }
    }
    return { error: t('actions.common.createBookingFailed', { detail: translateSupabaseError(rpcError?.message, locale) }) }
  }

  revalidatePath('/bookings')

  // Phase 20 #25 — fire booking_confirmation email. Fire-and-forget; if
  // Resend is down we still return success to the caller (the email_log
  // row records status='failed' for replay). Booking details are loaded
  // for the template body — the booking was just inserted so it's local.
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_code, check_in, check_out, nights, total, currency, booker_email, booker_full_name, room_type:room_types(name)')
      .eq('id', bookingId)
      .single()
    if (booking && sessionEmail) {
      const emailLocale = await getRecipientLocale({ userId: user.id })
      const roomTypeName =
        (booking.room_type as { name?: string } | null)?.name ??
        getT(emailLocale)('email.common.roomFallback')
      const { BookingConfirmationEmail, bookingConfirmationSubject } = await import(
        '@/lib/email/templates/booking-confirmation'
      )
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await sendEmail({
        to: sessionEmail,
        template: 'booking_confirmation',
        subject: bookingConfirmationSubject({
          bookingCode: booking.booking_code,
          checkIn: booking.check_in,
          locale: emailLocale,
        }),
        react: BookingConfirmationEmail({
          locale: emailLocale,
          bookingCode: booking.booking_code,
          guestName: booking.booker_full_name ?? '',
          roomTypeName,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          nights: booking.nights ?? 0,
          total: Number(booking.total),
          currency: booking.currency,
          viewUrl: `${appUrl}/bookings/${booking.id}`,
          refund: await getRefundNotice(booking.check_in),
        }),
        eventKey: `booking_confirmation:booking:${booking.id}`,
        bookingId: booking.id,
        metadata: { channel: 'web', nights: booking.nights },
      })
    }
  } catch (e) {
    // Email failure must not break the booking flow.
    console.error('[booking_confirmation] email dispatch failed:', e)
  }

  await recordRefundRuleAccepted(bookingId as string, data.checkIn, user.id)

  return { success: true, bookingId }
}

/**
 * Phase 57c — audit row proving the guest accepted the refund rule shown on
 * the booking form (min days + the resulting deadline at that moment).
 * Best-effort: a failed audit insert must not fail a booking that exists.
 */
async function recordRefundRuleAccepted(bookingId: string, checkIn: string, userId: string) {
  try {
    const minDays = await getRefundMinDays()
    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: bookingId,
      actor_id: userId,
      actor_role: 'user',
      event_type: 'refund_rule_accepted',
      description: `Guest accepted the refund rule (full refund until ${refundDeadlineIso(checkIn, minDays)})`,
      metadata: { min_days: minDays, refund_deadline: refundDeadlineIso(checkIn, minDays) },
    })
  } catch (e) {
    console.error('[refund_rule_accepted] audit insert failed:', e)
  }
}

// ============================================================================
// Phase 42 — Temporary/Pending Booking
// ============================================================================

const createTempBookingSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(10),
})

export type CreateTempBookingInput = z.infer<typeof createTempBookingSchema>

export interface CreateTempBookingResult {
  ok?: boolean
  error?: string
  bookingId?: string
  expiresAt?: string
}

/**
 * Phase 42 — Create a temporary/pending booking.
 *
 * Called by the "ยืนยันการจอง" button on /rooms/[id]. Inserts a real
 * `bookings` row with status='temp_pending' + hold_expires_at = now() + 2min.
 * The user then fills /bookings/new and submits the form, which calls
 * `completeTempBookingAction` to flip the same row to 'confirmed'.
 *
 * Differs from `createBooking`:
 *   - No form validation (user hasn't filled the form yet)
 *   - booker_* fields are pre-filled from user profile
 *   - status='temp_pending' (not 'confirmed')
 *   - hold_expires_at is set
 *   - No email fired (avoids spam from accidental clicks)
 *
 * Capacity check is in the RPC — same pool + confirmed + temp_pending
 * count as `create_booking`. Throws P0001 when pool exhausted.
 */
export async function createTempBookingAction(
  input: CreateTempBookingInput,
): Promise<CreateTempBookingResult> {
  const { locale, t } = await getServerT()
  const parsed = createTempBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: t('actions.common.invalidInput', { detail: translateZodIssues(parsed.error.issues, locale) }) }
  }
  const data = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: t('actions.common.notLoggedIn') }

  // Validate dates against today's minimum (Bangkok TZ). Phase 49
  // allows same-day check-in — only past dates are rejected.
  const today = getTodayBangkok()
  if (data.checkIn < today) {
    return { error: t('actions.common.checkinNotPast') }
  }
  if (data.checkIn >= data.checkOut) {
    return { error: t('actions.common.checkoutAfterCheckin') }
  }

  // Profile (suspension guard + booker pre-fill) and room (capacity +
  // price) are independent — fetch them in parallel.
  const [{ data: customerProfile }, { data: room, error: roomErr }] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_suspended, full_name, phone, role, terms_version')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('room_types').select('base_price, max_guests, is_active').eq('id', data.roomTypeId).maybeSingle(),
  ])

  // Phase 36 — block suspended customers (mirrors createBooking guard).
  if (customerProfile?.is_suspended) {
    return { error: t('actions.common.suspended') }
  }
  await redirectIfConsentMissing(customerProfile)
  if (roomErr || !room) return { error: t('actions.common.roomNotFound') }
  if (!room.is_active) return { error: t('actions.common.roomInactive') }
  if (data.guests > room.max_guests) {
    return { error: t('actions.common.maxGuests', { max: room.max_guests }) }
  }

  // Compute nights + base_subtotal for the temp booking. Don't include
  // promotion here (user hasn't entered a code yet). Tax/fee computed
  // server-side at completion time via getPricingConstants.
  const nights = calculateNights(data.checkIn, data.checkOut)
  if (nights === 0) {
    return { error: t('actions.common.nightsPositive') }
  }
  const baseSubtotal = room.base_price * nights

  // Pre-fill booker_* from profile (user can override on /bookings/new).
  const bookerFullName =
    customerProfile?.full_name ?? user.user_metadata?.full_name ?? ''
  const bookerEmail = user.email ?? ''
  const bookerPhone = customerProfile?.phone ?? user.user_metadata?.phone ?? ''

  // Hard guard — booker_phone has regex constraint (^[0-9]{10}$) at DB level.
  // If profile doesn't have a valid phone, default to a sentinel that the
  // user will be required to overwrite on /bookings/new before submit.
  // (The schema uses '0000000000' as the standard placeholder per
  // Phase 26.1 / 20260913_require_phone.sql.)
  const safeBookerPhone = /^[0-9]{10}$/.test(bookerPhone) ? bookerPhone : '0000000000'

  // Call RPC — service_role only (20261022), like create_booking.
  const admin = await createAdminClient()
  const { data: bookingId, error: rpcError } = await admin.rpc(
    'create_temp_booking',
    {
      p_user_id: user.id,
      p_room_type_id: data.roomTypeId,
      p_check_in: data.checkIn,
      p_check_out: data.checkOut,
      p_guests: data.guests,
      p_nights: nights,
      p_base_subtotal: baseSubtotal,
      p_total: baseSubtotal, // tax/fee added at complete_temp_booking time
      p_booker_full_name: bookerFullName || 'ผู้เข้าพัก',
      p_booker_email: bookerEmail,
      p_booker_phone: safeBookerPhone,
      p_hold_minutes: 3,
    },
  )

  if (rpcError || !bookingId) {
    if (rpcError?.code === 'P0001') {
      return {
        error:
          t('actions.common.roomSoldOut'),
      }
    }
    return {
      error: t('actions.booking.createTempFailed', { detail: translateSupabaseError(rpcError?.message, locale) }),
    }
  }

  revalidatePath('/rooms')
  revalidatePath('/bookings')

  return {
    ok: true,
    bookingId,
    // Phase 50 — lease is now 3 minutes (extended by heartbeat every
    // 30s on /bookings/new). The client uses the heartbeat result
    // to track the actual expires_at; this initial value is mostly
    // informational for the page that initiated the booking.
    expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
  }
}

const completeTempBookingSchema = z.object({
  bookingId: z.string().uuid(),
  bookerFullName: z.string().min(1).max(120),
  // Phase 51 — bookerEmail is no longer accepted from the client.
  // The session email is derived in the action body and the RPC
  // re-derives it for defense in depth.
  bookerPhone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'validation.phone10'),
  specialRequest: z.string().max(500).optional().nullable(),
  promoCode: z.string().max(40).optional().nullable(),
  // Phase 57c — the guest must tick "I accept the refund policy".
  acceptRefundRule: acceptRefundRuleSchema,
})

export type CompleteTempBookingInput = z.infer<typeof completeTempBookingSchema>

export interface CompleteTempBookingResult {
  ok?: boolean
  error?: string
  bookingId?: string
}

/**
 * Phase 42 — Finalize a temp_pending booking.
 *
 * Called by the form submit on /bookings/new when the user fills in the
 * remaining details + confirms. Flips the existing bookings row from
 * 'temp_pending' → 'confirmed' (atomic via the `complete_temp_booking`
 * SECURITY DEFINER RPC).
 *
 * Computes the final price (with optional promotion + tax/fee) and fires
 * the booking_confirmation email — same pattern as `createBooking` after
 * the RPC insert.
 */
export async function completeTempBookingAction(
  input: CompleteTempBookingInput,
): Promise<CompleteTempBookingResult> {
  const { locale, t } = await getServerT()
  const parsed = completeTempBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: t('actions.common.invalidInput', { detail: translateZodIssues(parsed.error.issues, locale) }) }
  }
  const data = parsed.data

  if (!isUuid(data.bookingId)) {
    return { error: t('actions.common.invalidBookingId') }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: t('actions.common.notLoggedIn') }

  // Phase 51 — derive the booking email from the authenticated account.
  // The form no longer collects email (locked on the customer form).
  // The RPC also re-derives it for defense in depth.
  const sessionEmail = user.email ?? ''
  if (!sessionEmail) {
    return {
      error:
        t('actions.common.noAccountEmail'),
    }
  }

  // Phase 36 suspension guard + the lazy-expiry sweep only need the user
  // id — run them together. The sweep must finish before the read below
  // so a stale row is flipped to 'expired' instead of being completed.
  const [{ data: customerProfile }] = await Promise.all([
    supabase.from('profiles').select('is_suspended, role, terms_version').eq('id', user.id).maybeSingle(),
    supabase.rpc('expire_specific_temp_booking', {
      p_booking_id: data.bookingId,
      p_user_id: user.id,
    }),
  ])
  if (customerProfile?.is_suspended) {
    return { error: t('actions.common.suspended') }
  }
  await redirectIfConsentMissing(customerProfile)

  // Load the existing temp booking. Confirms ownership + active state.
  const { data: existing, error: existingErr } = await supabase
    .from('bookings')
    .select('id, user_id, status, room_type_id, check_in, check_out, guests, currency')
    .eq('id', data.bookingId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existingErr) {
    return { error: t('actions.booking.loadFailed', { detail: translateSupabaseError(existingErr.message, locale) }) }
  }
  if (!existing) {
    return { error: t('actions.common.bookingNotFound') }
  }
  if (existing.status !== 'temp_pending') {
    if (existing.status === 'expired') {
      return { error: t('actions.booking.tempExpired') }
    }
    if (existing.status === 'cancelled') {
      return { error: t('actions.booking.alreadyCancelled') }
    }
    if (existing.status === 'confirmed') {
      return { error: t('actions.booking.alreadyConfirmed') }
    }
    return { error: t('actions.booking.statusNotEditable', { status: existing.status }) }
  }

  // Price inputs — all independent of each other, so fetch in parallel.
  const [{ data: room }, promotion, policy, seasonalRates, pricingSettings] = await Promise.all([
    supabase.from('room_types').select('base_price, max_guests').eq('id', existing.room_type_id).maybeSingle(),
    data.promoCode ? getPromotionByCode(data.promoCode) : Promise.resolve(null),
    getDefaultCancellationPolicy(),
    getActiveSeasonalRatesForRange({
      roomTypeId: existing.room_type_id,
      checkIn: existing.check_in,
      checkOut: existing.check_out,
    }),
    getPricingConstants(),
  ])
  if (!room) return { error: t('actions.common.roomNotFound') }
  if (existing.guests > room.max_guests) {
    return { error: t('actions.common.maxGuests', { max: room.max_guests }) }
  }
  if (data.promoCode && !promotion) return { error: t('actions.common.promoInvalid') }

  let quote
  try {
    quote = quoteStay({
      roomTypeId: existing.room_type_id,
      basePrice: room.base_price,
      checkIn: existing.check_in,
      checkOut: existing.check_out,
      rates: seasonalRates,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : t('actions.common.invalidDate') }
  }
  if (violatesMinNights(quote, seasonalRates)) {
    return { error: t('actions.common.minNights') }
  }

  const price = calculatePrice(
    {
      basePrice: room.base_price,
      checkIn: existing.check_in,
      checkOut: existing.check_out,
      guests: existing.guests,
      promotion: promotion
        ? {
            code: promotion.code,
            discountType: promotion.discount_type,
            discountValue: promotion.discount_value,
            minNights: promotion.min_nights,
            maxDiscountAmount: promotion.max_discount_amount ?? null,
          }
        : null,
      quote,
    },
    pricingSettings,
  )
  if (price.nights === 0) return { error: t('actions.common.nightsPositive') }

  // Call RPC — atomic UPDATE + audit row. service_role only (20261022): the
  // price above is the server's, p_user_id is the signed-in user, and the
  // RPC still checks the booking belongs to p_user_id.
  const admin = await createAdminClient()
  const { error: rpcError } = await admin.rpc('complete_temp_booking', {
    p_booking_id: data.bookingId,
    p_user_id: user.id,
    p_booker_full_name: data.bookerFullName,
    p_booker_email: sessionEmail,
    p_booker_phone: data.bookerPhone,
    p_special_request: data.specialRequest ?? null,
    p_promotion_id: promotion?.id ?? null,
    p_cancellation_policy_id: policy?.id ?? null,
    p_base_subtotal: price.baseSubtotal,
    p_discount_total: price.discountTotal,
    p_tax_total: price.taxTotal,
    p_fee_total: price.feeTotal,
    p_total: price.total,
    p_nights: price.nights,
  })

  if (rpcError) {
    const code = (rpcError as { code?: string }).code
    if (code === 'P0002') return { error: t('actions.common.bookingNotFound') }
    if (code === '42501') return { error: t('actions.common.notYourBooking') }
    if (code === 'P0001') {
      return { error: t('actions.booking.notTempAnymore') }
    }
    return { error: t('actions.booking.confirmFailed', { detail: translateSupabaseError(rpcError.message, locale) }) }
  }

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${data.bookingId}`)

  // Fire booking_confirmation email after the response is sent, so the
  // guest isn't kept waiting on Resend + the email_log writes before
  // landing on /bookings/[id]. `event_key` keeps it idempotent.
  after(async () => {
    try {
      const { data: booking } = await supabase
        .from('bookings')
        .select(
          'id, booking_code, check_in, check_out, nights, total, currency, booker_email, booker_full_name, room_type:room_types(name)',
        )
        .eq('id', data.bookingId)
        .single()
      if (booking && sessionEmail) {
        const emailLocale = await getRecipientLocale({ userId: user.id })
        const roomTypeName =
          (booking.room_type as { name?: string } | null)?.name ??
          getT(emailLocale)('email.common.roomFallback')
        const { BookingConfirmationEmail, bookingConfirmationSubject } = await import(
          '@/lib/email/templates/booking-confirmation'
        )
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        await sendEmail({
          to: sessionEmail,
          template: 'booking_confirmation',
          subject: bookingConfirmationSubject({
            bookingCode: booking.booking_code,
            checkIn: booking.check_in,
            locale: emailLocale,
          }),
          react: BookingConfirmationEmail({
            locale: emailLocale,
            bookingCode: booking.booking_code,
            guestName: booking.booker_full_name ?? '',
            roomTypeName,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            nights: booking.nights ?? 0,
            total: Number(booking.total),
            currency: booking.currency,
            viewUrl: `${appUrl}/bookings/${booking.id}`,
            refund: await getRefundNotice(booking.check_in),
          }),
          eventKey: `booking_confirmation:booking:${booking.id}`,
          bookingId: booking.id,
          metadata: { channel: 'web', nights: booking.nights },
        })
      }
    } catch (e) {
      console.error('[booking_confirmation] email dispatch failed:', e)
    }
  })

  await recordRefundRuleAccepted(data.bookingId, existing.check_in, user.id)

  return { ok: true, bookingId: data.bookingId }
}

/**
 * Phase 42 — Guest-initiated cancel of a temp_pending booking.
 *
 * Distinct from `cancelBooking` which handles the confirmed/checked_in flow
 * + refund policy logic. This just flips status to 'cancelled' without
 * any refund (no payment_status='paid' to refund).
 */
export async function cancelTempBookingAction(
  bookingId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const { locale, t } = await getServerT()
  if (!isUuid(bookingId)) return { error: t('actions.common.invalidBookingId') }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: t('actions.common.notLoggedIn') }

  const { error } = await supabase.rpc('cancel_temp_booking', {
    p_booking_id: bookingId,
    p_user_id: user.id,
  })

  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'P0002') return { error: t('actions.common.bookingNotFound') }
    if (code === '42501') return { error: t('actions.common.notYourBooking') }
    if (code === 'P0001') {
      return { error: t('actions.booking.tempNotCancellable') }
    }
    return { error: t('actions.booking.cancelFailed', { detail: translateSupabaseError(error.message, locale) }) }
  }

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)

  return { ok: true }
}

// ============================================================================
// Phase 50 — Lease heartbeat + explicit release (server actions)
// ============================================================================

export interface TouchBookingHoldResult {
  ok: boolean
  reason?: 'not_authenticated' | 'not_found' | 'not_owner' | 'not_temp_pending' | 'lapsed'
  expiresAt?: string
}

/**
 * Phase 50 — Heartbeat ping. Called by the leave-guard on
 * /bookings/new every ~30s while the page is mounted to extend the
 * rolling lease by 3 minutes. The server returns whether the lease
 * is still alive; the client uses this to decide whether to continue
 * rendering the form (ok:true) or surface a "การจองนี้หมดอายุแล้ว"
 * dialog and send the user back to /rooms (ok:false).
 *
 * Idempotent — many parallel pings from the same user are safe (the
 * UPDATE just keeps advancing hold_expires_at).
 */
export async function touchBookingHoldAction(
  bookingId: string,
): Promise<TouchBookingHoldResult> {
  if (!isUuid(bookingId)) {
    return { ok: false, reason: 'not_found' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'not_authenticated' }

  const { data, error } = await supabase.rpc('touch_booking_hold', {
    p_booking_id: bookingId,
  })

  if (error) {
    return { ok: false, reason: 'not_found' }
  }

  // The RPC returns a JSONB object. Normalize to our result shape.
  const result = (data ?? {}) as { ok?: boolean; reason?: string; expires_at?: string }
  if (result.ok) {
    return { ok: true, expiresAt: result.expires_at }
  }
  return { ok: false, reason: (result.reason as TouchBookingHoldResult['reason']) ?? 'lapsed' }
}

export interface ReleaseBookingHoldResult {
  ok: boolean
  reason?: 'not_authenticated' | 'not_owner'
  released?: boolean
}

/**
 * Phase 50 — Explicit release. Called by:
 *   1. The leave-guard "ออกจากหน้านี้" button on /bookings/new
 *   2. The idle auto-release (5 min no interaction → 60s countdown)
 *
 * Idempotent + owner-checked. Sets status='cancelled' and clears
 * hold_expires_at. Always returns ok:true unless the caller is not
 * the owner (defensive: don't allow a user to release someone else's
 * hold).
 */
export async function releaseBookingHoldAction(
  bookingId: string,
): Promise<ReleaseBookingHoldResult> {
  if (!isUuid(bookingId)) {
    return { ok: false, reason: 'not_owner' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'not_authenticated' }

  const { data, error } = await supabase.rpc('release_booking_hold', {
    p_booking_id: bookingId,
  })

  if (error) {
    return { ok: false, reason: 'not_owner' }
  }

  const result = (data ?? {}) as { ok?: boolean; reason?: string; released?: boolean }
  if (result.ok) {
    return { ok: true, released: !!result.released }
  }
  return { ok: false, reason: (result.reason as ReleaseBookingHoldResult['reason']) ?? 'not_owner' }
}

/**
 * Cancel a booking (sets status to 'cancelled').
 *
 * Phase 20 #24 — atomic via the `cancel_booking` SECURITY DEFINER RPC.
 * Phase 57b — the RPC applies the 2-day rule (full refund when cancelled at
 * least refund_min_days_before_checkin() days before check-in, otherwise
 * none), flips booking status, and inserts a `refund_requests`
 * row when the caller has paid AND the refund amount > 0 (manager then
 * reviews + approves via the existing /manager/bookings flow).
 *
 * Return shape now includes the computed refund_amount + penalty_amount
 * so the UI can show "คุณจะได้รับเงินคืน X บาท เสียค่าธรรมเนียม Y บาท"
 * per the 2-day rule.
 */
export interface CancelBookingResult {
  success?: boolean
  error?: string
  refundAmount?: number   // amount that will be refunded (0 if no refund row created)
  penaltyAmount?: number  // total - refundAmount
  refundRequestId?: string | null  // null when no refund row created (unpaid / penalty=0)
}

export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  const { locale, t } = await getServerT()
  if (!isUuid(bookingId)) return { error: t('actions.common.invalidBookingId') }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: t('actions.common.notLoggedIn') }

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
      return { error: t('actions.booking.cancelNotAllowed', { detail: translateSupabaseError(error.message, locale) }) }
    }
    if (code === 'P0002') {
      return { error: t('actions.common.bookingNotFound') }
    }
    return { error: t('actions.booking.cancelFailed', { detail: translateSupabaseError(error.message, locale) }) }
  }

  const row = Array.isArray(data) ? data[0] : data
  const refundAmount = row ? Number(row.refund_amount) : 0
  const penaltyAmount = row ? Number(row.penalty_amount) : 0
  const refundRequestId = row?.refund_request_id ?? null

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath('/manager/bookings')

  // Phase 20 #25 — cancellation_notice email (always fires — covers both
  // the "no refund outside free window" and the "refund pending approval"
  // cases). When refund_amount > 0 a refund_notice follows on manager
  // approval (separate template).
  await fireCancellationNotice({
    bookingId,
    penaltyAmount,
    refundAmount,
    refundRequestId,
  }).catch((e) => console.error('[cancellation_notice] failed:', e))
  await notifyBookingEvent(bookingId, { refundRequestId, refundAmount })

  return {
    success: true,
    refundAmount,
    penaltyAmount,
    refundRequestId,
  }
}

export type PreviewRefundResult =
  | {
      ok: true
      checkIn: string
      today: string
      daysUntil: number
      minDays: number
      eligible: boolean
      refundAmount: number
      alreadyRequested: boolean
    }
  | { ok: false; error: string }

/**
 * Phase 57 — what the refund dialog shows before the guest submits:
 * check-in date vs today (Asia/Bangkok) and whether the full-refund rule
 * (at least N days before check-in, N from the DB) is met. Read-only;
 * request_refund applies the same rule when the guest confirms.
 */
export async function previewRefundAction(bookingId: string): Promise<PreviewRefundResult> {
  const { locale, t } = await getServerT()
  if (!isUuid(bookingId)) return { ok: false, error: t('actions.common.invalidBookingId') }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('preview_refund', { p_booking_id: bookingId })
  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'P0002') return { ok: false, error: t('actions.common.bookingNotFound') }
    if (code === '42501') return { ok: false, error: t('actions.common.notYourBooking') }
    return { ok: false, error: translateSupabaseError(error.message, locale) }
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { ok: false, error: t('actions.common.bookingDataNotFound') }

  return {
    ok: true,
    checkIn: String(row.check_in),
    today: String(row.today),
    daysUntil: Number(row.days_until),
    minDays: Number(row.min_days),
    eligible: Boolean(row.eligible),
    refundAmount: Number(row.refund_amount),
    alreadyRequested: Boolean(row.already_requested),
  }
}

export interface RequestRefundResult {
  success?: boolean
  error?: string
  refundAmount?: number
  penaltyAmount?: number
}

/**
 * Phase 55 — guest asks for a refund on a confirmed + paid booking.
 *
 * Unlike `cancelBooking`, this does NOT cancel the booking: it records a
 * pending `refund_requests` row (amount snapshot from the cancellation
 * policy) and the stay stays valid until a manager decides. Approve →
 * `approve_refund` cancels the booking; reject → the guest keeps the stay.
 * One request per booking.
 */
export async function requestRefundAction(bookingId: string): Promise<RequestRefundResult> {
  const { locale, t } = await getServerT()
  if (!isUuid(bookingId)) return { error: t('actions.common.invalidBookingId') }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: t('actions.common.notLoggedIn') }

  const { data, error } = await supabase.rpc('request_refund', { p_booking_id: bookingId })

  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'P0002') return { error: t('actions.common.bookingNotFound') }
    if (code === '42501') return { error: t('actions.common.notYourBooking') }
    if (error.message.includes('REFUND_ALREADY_REQUESTED')) {
      return { error: t('actions.booking.refundAlreadyRequested') }
    }
    if (error.message.includes('REFUND_TOO_LATE')) {
      const min = /at least (\d+)/.exec(error.message)?.[1] ?? '2'
      return { error: t('actions.booking.refundTooLate', { min }) }
    }
    if (error.message.includes('REFUND_NOT_ELIGIBLE')) {
      return { error: t('actions.booking.refundNotEligible') }
    }
    return { error: t('actions.booking.refundRequestFailed', { detail: translateSupabaseError(error.message, locale) }) }
  }

  const row = Array.isArray(data) ? data[0] : data

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath('/manager/bookings')

  await notifyBookingEvent(bookingId, {
    refundRequestId: row?.refund_request_id ?? null,
    refundAmount: row ? Number(row.refund_amount) : 0,
  })

  return {
    success: true,
    refundAmount: row ? Number(row.refund_amount) : 0,
    penaltyAmount: row ? Number(row.penalty_amount) : 0,
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
  const { locale, t } = await getServerT()
  if (!isUuid(bookingId)) return { error: t('actions.common.invalidBookingId') }

  // requireRole redirects on auth failure — only manager/admin reach the
  // override block below. Reception can still cancel without override.
  const session = await requireRole(
    ['reception', 'manager', 'admin'],
    '/reception',
  )

  if (refundPctOverride !== null) {
    if (session.role !== 'manager' && session.role !== 'admin') {
      return { error: t('actions.booking.refundOverrideManagerOnly') }
    }
    if (refundPctOverride < 0 || refundPctOverride > 100) {
      return { error: t('actions.booking.refundPctRange') }
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
      return { error: t('actions.booking.cancelNotAllowed', { detail: translateSupabaseError(error.message, locale) }) }
    }
    if (code === 'P0002') {
      return { error: t('actions.common.bookingNotFound') }
    }
    return { error: t('actions.booking.cancelFailed', { detail: translateSupabaseError(error.message, locale) }) }
  }

  const row = Array.isArray(data) ? data[0] : data
  const refundAmount = row ? Number(row.refund_amount) : 0
  const penaltyAmount = row ? Number(row.penalty_amount) : 0
  const refundRequestId = row?.refund_request_id ?? null

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath('/reception/bookings')
  revalidatePath('/manager/bookings')

  // Phase 20 #25 — same email as the guest cancel path. Staff override
  // doesn't change the email template (guest still gets the policy notice).
  await fireCancellationNotice({
    bookingId,
    penaltyAmount,
    refundAmount,
    refundRequestId,
  }).catch((e) => console.error('[cancellation_notice] failed:', e))
  await notifyBookingEvent(bookingId, { refundRequestId, refundAmount, cancelledByStaff: true })

  return {
    success: true,
    refundAmount,
    penaltyAmount,
    refundRequestId,
  }
}

/**
 * Phase 60 — in-app notifications for a cancel / refund request:
 * managers + admins hear about a new refund request; the guest hears when
 * staff (not they themselves) cancelled the booking. Never throws.
 */
async function notifyBookingEvent(
  bookingId: string,
  opts: { refundRequestId: string | null; refundAmount: number; cancelledByStaff?: boolean },
): Promise<void> {
  if (!opts.refundRequestId && !opts.cancelledByStaff) return
  try {
    const admin = await createAdminClient()
    const { data: booking } = await admin
      .from('bookings')
      .select('id, user_id, booking_code')
      .eq('id', bookingId)
      .single()
    if (!booking) return
    if (opts.refundRequestId) {
      await notifyRoles(['manager', 'admin'], {
        type: 'refund_requested_new',
        params: { code: booking.booking_code, amount: opts.refundAmount },
        link: '/manager/bookings?tab=refunds',
        bookingId,
        eventKey: `refund_requested_new:${opts.refundRequestId}`,
      })
    }
    if (opts.cancelledByStaff) {
      await notifyUser(booking.user_id, {
        type: 'booking_cancelled',
        params: { code: booking.booking_code },
        link: `/bookings/${bookingId}`,
        bookingId,
        eventKey: `booking_cancelled:${bookingId}`,
      })
    }
  } catch (e) {
    console.error('[notify] booking event failed:', e)
  }
}

/**
 * Phase 20 #25 — internal helper. Loads the booking + guest email then
 * fires the cancellation_notice template. Centralised because both the
 * guest `cancelBooking` and the staff `cancelBookingByStaff` paths need
 * the same email.
 *
 * Phase 52 — exported (was previously module-private) so the new
 * `cancelUnpaidBookingAction` can reuse it for the no-refund case.
 * Reads the booking row to populate the template; refund/policy numbers
 * are passed in for the paid path (template body has dedicated fields)
 * and default to 0 for the unpaid path.
 */
export async function fireCancellationNotice(args: {
  bookingId: string
  penaltyAmount?: number
  refundAmount?: number
  refundRequestId?: string | null
}): Promise<void> {
  const supabase = await createClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, booking_code, booker_email, booker_full_name, total, currency, payment_status')
    .eq('id', args.bookingId)
    .single()
  if (!booking || !booking.booker_email) return
  const refundAmount = args.refundAmount ?? 0
  const penaltyAmount = args.penaltyAmount ?? Number(booking.total)
  // Phase 57b — the email explains the outcome instead of naming a policy.
  const outcome =
    booking.payment_status !== 'paid' ? 'unpaid' : refundAmount > 0 ? 'refund_requested' : 'too_late'
  const minDays = await getRefundMinDays()
  const emailLocale = await getRecipientLocale({ userId: booking.user_id })
  const { CancellationNoticeEmail, cancellationNoticeSubject } = await import(
    '@/lib/email/templates/cancellation-notice'
  )
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendEmail({
    to: booking.booker_email,
    template: 'cancellation_notice',
    subject: cancellationNoticeSubject({
      bookingCode: booking.booking_code,
      locale: emailLocale,
    }),
    react: CancellationNoticeEmail({
      locale: emailLocale,
      bookingCode: booking.booking_code,
      guestName: booking.booker_full_name ?? '',
      outcome,
      minDays,
      penaltyAmount,
      refundAmount,
      currency: booking.currency,
      viewUrl: `${appUrl}/bookings/${booking.id}`,
    }),
    eventKey: `cancellation_notice:booking:${booking.id}`,
    bookingId: booking.id,
    refundRequestId: args.refundRequestId,
    metadata: { outcome, penalty: args.penaltyAmount },
  })
}
