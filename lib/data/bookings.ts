import { createClient } from '@/lib/supabase/server'
import { wrapSupabaseError } from '@/lib/errors/supabase'
import type { RoomTypeName } from './types'

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
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  payment_status: 'unpaid' | 'paid' | 'refunded' | 'partial_refund'
  booker_full_name: string
  booker_email: string
  booker_phone: string | null
  special_request: string | null
  created_at: string
  updated_at: string
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
  min_nights: number
}

/**
 * Get user's bookings, optionally filtered by status.
 * Returns most recent first.
 */
export async function getUserBookings(
  userId: string,
  statusFilter?: Booking['status'][]
): Promise<Booking[]> {
  const supabase = await createClient()

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
