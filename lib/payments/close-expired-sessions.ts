import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 56 — close the Stripe Checkout page of every booking that is no
 * longer payable (payment deadline passed, or cancelled).
 *
 * A Stripe session must live ≥ 30 min, but the guest only gets 5 min to
 * pay. The per-minute pg_cron job expires the booking, then calls
 * /api/cron/close-expired-sessions, which runs this. Expiring the session
 * stops a late payment on a room that may already be re-sold; if one
 * still slips through, the webhook's auto-refund branch handles it.
 */
export async function closeExpiredCheckoutSessions(
  stripe: Stripe,
  admin: SupabaseClient,
  limit = 50,
): Promise<{ closed: number; failed: number }> {
  const { data, error } = await admin
    .from('payments')
    .select('id, provider_session_id, booking:bookings!inner(status)')
    .eq('status', 'pending')
    .not('provider_session_id', 'is', null)
    .in('booking.status', ['expired', 'cancelled', 'payment_expired'])
    .limit(limit)
  if (error) throw new Error(`load payments: ${error.message}`)

  let closed = 0
  let failed = 0
  for (const row of data ?? []) {
    const sessionId = row.provider_session_id as string
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      // A completed session is a real payment — leave it to the webhook.
      if (session.status === 'complete') continue
      if (session.status === 'open') await stripe.checkout.sessions.expire(sessionId)
      const { error: rpcErr } = await admin.rpc('expire_payment_session', {
        p_session_id: sessionId,
        p_event_id: `deadline:${sessionId}`,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      closed++
    } catch (e) {
      failed++
      console.warn('[closeExpiredCheckoutSessions]', sessionId, e instanceof Error ? e.message : e)
    }
  }
  return { closed, failed }
}
