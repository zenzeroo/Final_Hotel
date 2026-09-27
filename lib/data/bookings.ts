import { createClient } from '@/lib/supabase/server'
import { wrapSupabaseError } from '@/lib/errors/supabase'
import type { RefundRequestStatus, RefundStatusForBooking, RoomTypeName } from './types'

export interface Booking {
  id: string
  booking_code: string
  user_id: string
  room_type_id: string
  check_in: string
  check_out: string
  guests: number
  nights: number
  base_subtotal: number
  discount_total: number
  tax_total: number
  fee_total: number
  total: number
  currency: string
  promotion_id: string | null
  cancellation_policy_id: string | null
  // Phase 42 — added 'temp_pending' (reserving slot, awaiting form submit)
  // and 'expired' (hold timer elapsed, lazy-flipped or via daily cron).
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'temp_pending' | 'expired'
  payment_status: 'unpaid' | 'paid' | 'refunded' | 'partial_refund'
  booker_full_name: string
  booker_email: string
  booker_phone: string | null
  special_request: string | null
  created_at: string
  updated_at: string
  // Phase 42 — set when status='temp_pending'; null when status='confirmed'/'cancelled'/etc.
  // Filters out from availability queries once hold_expires_at < now() (no cron required).
  hold_expires_at: string | null
  // Joined fields
  room_type?: {
    id: string
    slug: string
    name: string
    name_th: string
    type: RoomTypeName
    hero_image_key: string
  }
}

export interface CancellationPolicy {
  id: string
  name: string
  free_cancel_hours: number
  refund_pct: number
  description: string
  is_default: boolean
}

export interface Promotion {
  id: string
  code: string
  name: string
  description: string | null
  discount_type: 'percent' | 'flat'
  discount_value: number
  /** Phase 27 — optional THB cap on percent-type discount. */
  max_discount_amount: number | null
  /** Phase 27 — optional restrict-to list (room_type_enum[]). */
  applies_to_room_types: RoomTypeName[] | null
  min_nights: number
}

/**
 * Get user's bookings, optionally filtered by status.
 * Returns most recent first.
 *
 * Phase 42 — lazy expiry: flips any stale temp_pending bookings to 'expired'
 * before reading (no cron required). See `expire_user_temp_bookings` RPC
 * at supabase/migrations/20261004_2_temp_pending_bookings.sql.
 */
export async function getUserBookings(
  userId: string,
  statusFilter?: Booking['status'][]
): Promise<Booking[]> {
  const supabase = await createClient()

  // Lazy expiry — atomic UPDATE + audit row insert. Returns count but we
  // don't need it (re-query below picks up the new statuses).
  await supabase.rpc('expire_user_temp_bookings', { p_user_id: userId })

  let query = supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, slug, name, name_th, type, hero_image_key)
    `)
    .eq('user_id', userId)
    .order('check_in', { ascending: false })

  if (statusFilter && statusFilter.length > 0) {
    query = query.in('status', statusFilter)
  }

  const { data, error } = await query
  if (error) wrapSupabaseError('', error)

  return (data ?? []) as Booking[]
}

/**
 * Get a single booking by ID (must belong to user).
 */
export async function getBookingById(
  bookingId: string,
  userId: string
): Promise<Booking | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, slug, name, name_th, type, hero_image_key)
    `)
    .eq('id', bookingId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) wrapSupabaseError('', error)
  return (data as Booking) ?? null
}

/**
 * Phase 42 — fetch a single booking by id with LAZY EXPIRY for the owner.
 *
 * Unlike `getBookingById` (which is generic), this also runs
 * `expire_specific_temp_booking` before reading so a stale temp_pending
 * row is flipped to 'expired' before the caller sees it. The returned
 * row will reflect the post-expiry status — i.e. if the hold timer
 * elapsed, the caller sees `status='expired'` instead of `temp_pending`.
 *
 * Used by /bookings/[id] (user detail page) and /bookings/new (form
 * re-entry after creating a temp booking) so the UI can react to expiry
 * without polling.
 *
 * Returns null if:
 *   - booking doesn't exist
 *   - owner mismatch (RLS denies)
 *   - booking was hard-deleted
 */
export async function getTempBookingById(
  bookingId: string,
  userId: string
): Promise<Booking | null> {
  const supabase = await createClient()

  // Lazy expiry — flips stale temp_pending to expired + audit row.
  // Atomic in single transaction.
  await supabase.rpc('expire_specific_temp_booking', {
    p_booking_id: bookingId,
    p_user_id: userId,
  })

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, slug, name, name_th, type, hero_image_key)
    `)
    .eq('id', bookingId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) wrapSupabaseError('', error)
  return (data as Booking) ?? null
}

/**
 * Lightweight RLS-safe payment_status fetch used by the Stripe success
 * modal polling (app/actions/payment.ts:pollBookingPaymentStatusAction).
 * Selects only the payment_status column — no joins — so the modal
 * can poll every 2s without heavy DB load.
 *
 * Returns null when the booking doesn't exist OR the user doesn't own
 * it (RLS denies) — both are indistinguishable to the caller, which
 * is fine for UX (just keep polling / show timeout).
 */
export async function getBookingPaymentStatus(
  bookingId: string,
  userId: string,
): Promise<'unpaid' | 'paid' | 'refunded' | 'partial_refund' | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.payment_status as
    | 'unpaid'
    | 'paid'
    | 'refunded'
    | 'partial_refund'
    | null) ?? null
}

/**
 * Get default cancellation policy.
 */
export async function getDefaultCancellationPolicy(): Promise<CancellationPolicy | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cancellation_policies')
    .select('*')
    .eq('is_default', true)
    .maybeSingle()

  if (error) wrapSupabaseError('', error)
  return (data as CancellationPolicy) ?? null
}

/**
 * Get a cancellation policy by ID (RLS-safe read; cancellation_policies
 * are public so any auth.uid() can read them).
 */
export async function getCancellationPolicyById(
  policyId: string,
): Promise<CancellationPolicy | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cancellation_policies')
    .select('*')
    .eq('id', policyId)
    .maybeSingle()

  if (error) wrapSupabaseError('', error)
  return (data as CancellationPolicy) ?? null
}

/**
 * Get promotion by code (must be active).
 */
export async function getPromotionByCode(code: string): Promise<Promotion | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  if (error) wrapSupabaseError('', error)
  return (data as Promotion) ?? null
}

/**
 * Phase 29 — read the latest refund_request for a booking. RLS-restricted:
 * the `refund_requests owner read` policy added in
 * `20260919_refund_approval_hardening.sql` lets the booking owner SELECT
 * only their own refund rows. Returns null when there's no refund yet
 * (e.g. unpaid booking, or non-cancelled booking).
 */
export async function getRefundStatusForBooking(
  bookingId: string,
  userId: string,
): Promise<RefundStatusForBooking | null> {
  const supabase = await createClient()
  // First verify the booking belongs to this user — defence-in-depth on top
  // of the RLS subquery (which already filters via bookings.user_id).
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!booking) return null

  const { data, error } = await supabase
    .from('refund_requests')
    .select('status, amount, decided_at, decided_by')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) wrapSupabaseError('getRefundStatusForBooking', error)
  if (!data) return null
  return {
    status: data.status as RefundRequestStatus,
    amount: Number(data.amount),
    decidedAt: data.decided_at ?? null,
    decidedBy: data.decided_by ?? null,
  }
}
