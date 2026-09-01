/**
 * Phase 17 — Real Supabase payments impl.
 *
 * `createPaymentSession` calls the SECURITY DEFINER RPC which locks the
 * booking, verifies owner/staff, and returns/inserts a pending payments row.
 * All other reads use the user-context `createClient()` so RLS is enforced.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wrapSupabaseError } from '@/lib/errors/supabase'
import type { Payment } from '@/lib/payments/types'

export async function createPaymentSession(input: {
  bookingId: string
  amount?: number
  currency?: string
}): Promise<Payment> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_payment_session', {
    p_booking_id: input.bookingId,
  })
  if (error) wrapSupabaseError('createPaymentSession', error)
  return data as unknown as Payment
}

export async function getPaymentBySessionId(sessionId: string): Promise<Payment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('provider_session_id', sessionId)
    .maybeSingle()
  if (error) wrapSupabaseError('getPaymentBySessionId', error)
  return (data as Payment) ?? null
}

export async function listPaymentsByBooking(bookingId: string): Promise<Payment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) wrapSupabaseError('listPaymentsByBooking', error)
  return (data ?? []) as Payment[]
}

/**
 * Persists Stripe's Checkout Session id + URLs back to the pending payments
 * row. Uses the admin client because the action layer already verified
 * owner/staff via the RPC above — and Stripe's session URL contains a
 * non-PII token we don't want leaking through user-context RLS.
 */
export async function updatePaymentSessionId(input: {
  paymentId: string
  sessionId: string
  successUrl?: string | null
  cancelUrl?: string | null
}): Promise<Payment | null> {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('payments')
    .update({
      provider_session_id: input.sessionId,
      success_url: input.successUrl ?? null,
      cancel_url: input.cancelUrl ?? null,
    })
    .eq('id', input.paymentId)
    .select('*')
    .maybeSingle()
  if (error) wrapSupabaseError('updatePaymentSessionId', error)
  return (data as Payment) ?? null
}