/**
 * Phase 19 #18 — confirm_refund_session partial_refund race fix integration test.
 *
 * Verifies that Phase 19 #18 closes the gap where the webhook-driven
 * `confirm_refund_session` RPC unconditionally wrote
 * `bookings.payment_status='refunded'` on `charge.refunded` arrival,
 * clobbering the action-layer override that sets `'partial_refund'` for
 * partial-amount Stripe refunds.
 *
 * Test cases:
 *   1. Normal flow (no regression): booking paid → RPC → status flips to
 *      'refunded' + payments.status='refunded' + audit row inserted.
 *   2. Race fix (the new behavior): booking paid → action-layer override
 *      to 'partial_refund' → RPC arrives → bookings.payment_status is
 *      STILL 'partial_refund' (not clobbered) + payments.status='refunded'
 *      (unconditional — reflects real Stripe state).
 *   3. Idempotency: replay same event_id → no duplicate booking_events
 *      row + same payments row.
 *   4. Already-refunded: booking already 'refunded' → RPC is silent no-op
 *      (preserves idempotent contract from Phase 18).
 *
 * Prereqs:
 *   - Migration 20260910_fix_confirm_refund_rpc_partial.sql applied
 *   - Migration 20260903_confirm_refund_rpc.sql applied (original)
 *   - PostgREST schema cache reloaded: `NOTIFY pgrst, 'reload schema';`
 *   - Test fixture user (test@zenzero.com) — scripts/_rbac-fixture.mts
 *
 * Run: npx tsx scripts/test-phase19-refund-race-fix.mts
 *
 * Cleanup: bookings tagged with `booking_code` prefix `ZZR-P19-#18-`.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!BASE || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local')
  process.exit(1)
}

const svc = createServiceClient(BASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let passed = 0
let failed = 0
async function step(name: string, fn: () => Promise<string | void> | void) {
  process.stdout.write('▶ ' + name + '\n')
  try {
    const r = await fn()
    console.log('  ✓ ' + name + (r ? ' — ' + r : ''))
    passed++
  } catch (e) {
    console.log('  ✗ ' + name + ' — ' + (e as Error).message)
    failed++
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const PREFIX = 'ZZR-P19-#18-'

// ── Cleanup any leftover rows from previous runs ─────────────────────────
async function cleanup() {
  // bookings deletion cascades via FK to refund_requests + booking_events.
  // payments FK is ON DELETE RESTRICT so delete payments first.
  const { data: bookings } = await svc
    .from('bookings')
    .select('id')
    .like('booking_code', `${PREFIX}%`)
  if (bookings && bookings.length > 0) {
    const ids = bookings.map((b) => b.id)
    // Clear payments first (FK restrict); then bookings cascade.
    await svc.from('payments').delete().in('booking_id', ids)
    await svc.from('bookings').delete().in('id', ids)
  }
}
await cleanup()

// ── Fixtures ────────────────────────────────────────────────────────────
const { data: usersList } = await svc.auth.admin.listUsers()
const testUser = usersList?.users.find((u) => u.email === 'test@zenzero.com')
if (!testUser) {
  console.error('test@zenzero.com not found — run scripts/_rbac-fixture.mts first')
  process.exit(1)
}
const testUserId = testUser.id

const { data: roomType } = await svc
  .from('room_types')
  .select('id')
  .eq('is_active', true)
  .limit(1)
  .single()
if (!roomType) {
  console.error('No active room_type found — seed data missing')
  process.exit(1)
}

const { data: flexPolicy } = await svc
  .from('cancellation_policies')
  .select('id')
  .eq('name', 'Flexible')
  .single()

// Helper: create a booking via the atomic create_booking RPC.
async function createBooking(checkIn: string, checkOut: string): Promise<string> {
  const code = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const total = 5000
  const nights =
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
    (24 * 3600 * 1000)
  const { data, error } = await svc.rpc('create_booking', {
    p_user_id: testUserId,
    p_room_type_id: roomType.id,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_guests: 1,
    p_nights: Math.max(1, Math.round(nights)),
    p_base_subtotal: total,
    p_discount_total: 0,
    p_tax_total: 0,
    p_fee_total: 0,
    p_total: total,
    p_currency: 'THB',
    p_promotion_id: null,
    p_cancellation_policy_id: flexPolicy?.id ?? null,
    p_booker_full_name: 'Race Fix Test',
    p_booker_email: 'test@zenzero.com',
    p_booker_phone: null,
    p_special_request: null,
    p_channel: 'web',
    p_booking_code: code,
  })
  if (error || !data) throw new Error(`create_booking failed: ${error?.message ?? 'no id'}`)
  return data as string
}

// Helper: insert a 'succeeded' payment row tied to the booking + return
// the row id. Sets provider_payment_id to a fake 'pi_test_<random>' so
// confirm_refund_session can find it.
async function createPayment(bookingId: string): Promise<{ id: string; provider_payment_id: string }> {
  const provider_payment_id = `pi_test_p19r18_${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await svc
    .from('payments')
    .insert({
      booking_id: bookingId,
      provider: 'stripe',
      provider_payment_id,
      payment_method: 'card',
      amount: 5000,
      currency: 'THB',
      status: 'succeeded',
      paid_at: new Date().toISOString(),
    })
    .select('id, provider_payment_id')
    .single()
  if (error || !data) throw new Error(`createPayment failed: ${error?.message}`)
  return data as { id: string; provider_payment_id: string }
}

// Use unique dates in year 2032 to avoid collision with prior tests.
function dateRange(monthOffset: number, nights: number): { ci: string; co: string } {
  const ci = new Date(Date.UTC(2032, monthOffset, 1))
  const co = new Date(ci)
  co.setUTCDate(co.getUTCDate() + nights)
  return {
    ci: ci.toISOString().slice(0, 10),
    co: co.toISOString().slice(0, 10),
  }
}

// ── Test cases ──────────────────────────────────────────────────────────

await step('Case 1 — Normal flow: booking paid → RPC → status flips to refunded', async () => {
  const { ci, co } = dateRange(0, 2) // Jan 2032, 2 nights
  const bookingId = await createBooking(ci, co)

  // Force payment_status to 'paid'
  await svc.from('bookings').update({ payment_status: 'paid' }).eq('id', bookingId)

  // Create a succeeded payment row
  const payment = await createPayment(bookingId)

  // Call confirm_refund_session with a fresh event_id
  const eventId = `evt_p19r18_normal_${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await svc.rpc('confirm_refund_session', {
    p_payment_intent: payment.provider_payment_id,
    p_event_id: eventId,
  })
  assert(!error, `RPC failed: ${error?.message}`)
  assert(data, 'RPC returned no data')

  // Verify booking.payment_status flipped to 'refunded'
  const { data: booking } = await svc
    .from('bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .single()
  assert(
    booking?.payment_status === 'refunded',
    `expected 'refunded', got '${booking?.payment_status}'`
  )

  // Verify payments.status flipped to 'refunded'
  const { data: pay } = await svc
    .from('payments')
    .select('status')
    .eq('id', payment.id)
    .single()
  assert(pay?.status === 'refunded', `expected payments 'refunded', got '${pay?.status}'`)

  // Verify booking_events audit row exists
  const { data: events } = await svc
    .from('booking_events')
    .select('id, event_type')
    .eq('booking_id', bookingId)
    .eq('event_type', 'refund_confirmed')
  assert(events && events.length === 1, `expected 1 refund_confirmed audit row, got ${events?.length}`)
})

await step('Case 2 — Race fix: action-layer override → RPC → booking stays partial_refund', async () => {
  const { ci, co } = dateRange(2, 2) // Mar 2032
  const bookingId = await createBooking(ci, co)

  // Force payment_status to 'paid'
  await svc.from('bookings').update({ payment_status: 'paid' }).eq('id', bookingId)

  // Create a succeeded payment row
  const payment = await createPayment(bookingId)

  // Simulate the action-layer override: manager approves partial refund →
  // approve_refund RPC → status='refunded' → action override → 'partial_refund'
  await svc.from('bookings').update({ payment_status: 'partial_refund' }).eq('id', bookingId)

  // Confirm pre-state
  const { data: pre } = await svc
    .from('bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .single()
  assert(
    pre?.payment_status === 'partial_refund',
    `pre-state should be 'partial_refund', got '${pre?.payment_status}'`
  )

  // Now the webhook arrives (late) → confirm_refund_session fires
  const eventId = `evt_p19r18_race_${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await svc.rpc('confirm_refund_session', {
    p_payment_intent: payment.provider_payment_id,
    p_event_id: eventId,
  })
  assert(!error, `RPC failed: ${error?.message}`)
  assert(data, 'RPC returned no data')

  // Verify booking.payment_status is STILL 'partial_refund' (NOT clobbered)
  const { data: booking } = await svc
    .from('bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .single()
  assert(
    booking?.payment_status === 'partial_refund',
    `RACE BUG: expected 'partial_refund' preserved, got '${booking?.payment_status}'`
  )

  // Verify payments.status flipped to 'refunded' (unconditional — real Stripe state)
  const { data: pay } = await svc
    .from('payments')
    .select('status')
    .eq('id', payment.id)
    .single()
  assert(pay?.status === 'refunded', `expected payments 'refunded', got '${pay?.status}'`)

  // Verify booking_events audit row still recorded (race fix doesn't suppress audit)
  const { data: events } = await svc
    .from('booking_events')
    .select('id, event_type')
    .eq('booking_id', bookingId)
    .eq('event_type', 'refund_confirmed')
  assert(events && events.length === 1, `expected 1 refund_confirmed audit row, got ${events?.length}`)
})

await step('Case 3 — Idempotency: same event_id twice → no duplicate audit row', async () => {
  const { ci, co } = dateRange(4, 2) // May 2032
  const bookingId = await createBooking(ci, co)
  await svc.from('bookings').update({ payment_status: 'paid' }).eq('id', bookingId)
  const payment = await createPayment(bookingId)

  const eventId = `evt_p19r18_idem_${Math.random().toString(36).slice(2, 10)}`
  // First call
  const { error: e1 } = await svc.rpc('confirm_refund_session', {
    p_payment_intent: payment.provider_payment_id,
    p_event_id: eventId,
  })
  assert(!e1, `first call failed: ${e1?.message}`)

  // Replay
  const { error: e2 } = await svc.rpc('confirm_refund_session', {
    p_payment_intent: payment.provider_payment_id,
    p_event_id: eventId,
  })
  assert(!e2, `replay failed: ${e2?.message}`)

  // Verify only 1 audit row
  const { data: events } = await svc
    .from('booking_events')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('event_type', 'refund_confirmed')
  assert(
    events && events.length === 1,
    `expected 1 audit row (idempotent), got ${events?.length}`
  )
})

await step('Case 4 — Already-refunded: booking.status=refunded → RPC is silent no-op', async () => {
  const { ci, co } = dateRange(6, 2) // Jul 2032
  const bookingId = await createBooking(ci, co)
  await svc.from('bookings').update({ payment_status: 'refunded' }).eq('id', bookingId)
  const payment = await createPayment(bookingId)

  // Pre-mark payments as refunded (Phase 18 short-circuit checks this)
  await svc.from('payments').update({ status: 'refunded' }).eq('id', payment.id)

  const eventId = `evt_p19r18_already_${Math.random().toString(36).slice(2, 10)}`
  const { error } = await svc.rpc('confirm_refund_session', {
    p_payment_intent: payment.provider_payment_id,
    p_event_id: eventId,
  })
  assert(!error, `RPC failed: ${error?.message}`)

  // booking.status should still be 'refunded' (no change)
  const { data: booking } = await svc
    .from('bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .single()
  assert(booking?.payment_status === 'refunded', `expected 'refunded', got '${booking?.payment_status}'`)
})

// ── Cleanup ──────────────────────────────────────────────────────────────
await cleanup()

console.log('')
console.log(`Done. ${passed} passed, ${failed} failed.`)
process.exit(failed === 0 ? 0 : 1)
