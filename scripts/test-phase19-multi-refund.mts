/**
 * Phase 19 #19 — Multi-refund aggregation integration test.
 *
 * Verifies that the approve_refund + confirm_refund_session RPCs now
 * aggregate ALL approved refunds for a booking vs the succeeded payment
 * total to compute the correct `payment_status` label:
 *
 *   - sum(approved_refunds) >= sum(succeeded_payments) → 'refunded'
 *   - 0 < sum(approved_refunds) < sum(succeeded_payments) → 'partial_refund'
 *
 * Closes the gap where multiple partial refunds on the same booking
 * would clobber the 'partial_refund' label back to 'refunded' on every
 * approval, because the old RPC wrote 'refunded' unconditionally.
 *
 * Test cases:
 *   1. Single full refund: 5000 paid, 5000 refund → 'refunded'
 *   2. Single partial refund: 5000 paid, 2500 refund → 'partial_refund'
 *   3. Two refunds summing to full: 5000 paid, 3000 + 2000 → 'refunded'
 *   4. Two refunds summing to partial: 5000 paid, 1500 + 1500 → 'partial_refund'
 *   5. Third refund completes: from case 4, +2000 more → 'refunded'
 *   6. Idempotency: re-approving a refund throws SQLSTATE P0001 (already decided)
 *   7. Webhook path: confirm_refund_session aggregates across multiple
 *      approved refund_requests rows when the webhook arrives.
 *
 * Prereqs:
 *   - Migration 20260911_approve_refund_aggregate.sql applied
 *   - Migration 20260910_fix_confirm_refund_rpc_partial.sql applied
 *   - Migration 20260903_confirm_refund_rpc.sql applied
 *   - PostgREST schema cache reloaded: NOTIFY pgrst, 'reload schema';
 *   - Test fixture user (test@zenzero.com) — scripts/_rbac-fixture.mts
 *
 * Run: npx tsx scripts/test-phase19-multi-refund.mts
 *
 * Cleanup: bookings tagged with `booking_code` prefix `ZZR-P19-#19-`.
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

const PREFIX = 'ZZR-P19-#19-'

// ── Cleanup any leftover rows from previous runs ─────────────────────────
async function cleanup() {
  // payments FK is ON DELETE RESTRICT so delete payments first.
  const { data: bookings } = await svc
    .from('bookings')
    .select('id')
    .like('booking_code', `${PREFIX}%`)
  if (bookings && bookings.length > 0) {
    const ids = bookings.map((b) => b.id)
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
    p_booker_full_name: 'Multi-Refund Test',
    p_booker_email: 'test@zenzero.com',
    p_booker_phone: '0890000005',
    p_special_request: null,
    p_channel: 'web',
    p_booking_code: code,
  })
  if (error || !data) throw new Error(`create_booking failed: ${error?.message ?? 'no id'}`)
  return data as string
}

// Helper: insert a 'succeeded' Stripe payment row tied to the booking.
async function createPayment(
  bookingId: string,
  amount = 5000,
  provider: 'stripe' | 'cash' = 'stripe',
): Promise<{ id: string; provider_payment_id: string | null }> {
  const provider_payment_id =
    provider === 'stripe'
      ? `pi_test_p19r19_${Math.random().toString(36).slice(2, 10)}`
      : null
  const { data, error } = await svc
    .from('payments')
    .insert({
      booking_id: bookingId,
      provider,
      provider_payment_id,
      payment_method: provider === 'stripe' ? 'card' : 'cash',
      amount,
      currency: 'THB',
      status: 'succeeded',
      paid_at: new Date().toISOString(),
    })
    .select('id, provider_payment_id')
    .single()
  if (error || !data) throw new Error(`createPayment failed: ${error?.message}`)
  return data as { id: string; provider_payment_id: string | null }
}

// Helper: insert a pending refund_request row tied to the booking.
async function createRefundRequest(
  bookingId: string,
  amount: number,
): Promise<string> {
  const { data: booking } = await svc
    .from('bookings')
    .select('booking_code, booker_full_name')
    .eq('id', bookingId)
    .single()
  const { data, error } = await svc
    .from('refund_requests')
    .insert({
      booking_id: bookingId,
      booking_code: booking?.booking_code ?? 'unknown',
      guest_name: booking?.booker_full_name ?? 'Test',
      reason: 'multi-refund aggregation test',
      amount,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createRefundRequest failed: ${error?.message}`)
  return data.id as string
}

// Helper: read current bookings.payment_status
async function getPaymentStatus(bookingId: string): Promise<string> {
  const { data, error } = await svc
    .from('bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .single()
  if (error || !data) throw new Error(`getPaymentStatus failed: ${error?.message}`)
  return data.payment_status
}

// Use unique dates in year 2033 to avoid collision with prior tests.
function dateRange(monthOffset: number, nights: number): { ci: string; co: string } {
  const ci = new Date(Date.UTC(2033, monthOffset, 1))
  const co = new Date(ci)
  co.setUTCDate(co.getUTCDate() + nights)
  return {
    ci: ci.toISOString().slice(0, 10),
    co: co.toISOString().slice(0, 10),
  }
}

// Counter for unique date slots across cases
let dateSlot = 0

// ── Case 1: single full refund → 'refunded' ─────────────────────────────
await step('Case 1: single refund = full payment → refunded', async () => {
  const { ci, co } = dateRange(dateSlot++, 2)
  const bookingId = await createBooking(ci, co)
  await createPayment(bookingId, 5000)
  const refundId = await createRefundRequest(bookingId, 5000)

  // approve_refund is SECURITY DEFINER — call via RPC (no auth context here).
  const { error } = await svc.rpc('approve_refund', { p_refund_id: refundId })
  assert(!error, `approve_refund failed: ${error?.message}`)

  const status = await getPaymentStatus(bookingId)
  assert(status === 'refunded', `expected 'refunded', got '${status}'`)
})

// ── Case 2: single partial refund → 'partial_refund' ─────────────────────
await step('Case 2: single partial refund → partial_refund', async () => {
  const { ci, co } = dateRange(dateSlot++, 2)
  const bookingId = await createBooking(ci, co)
  await createPayment(bookingId, 5000)
  const refundId = await createRefundRequest(bookingId, 2500)

  const { error } = await svc.rpc('approve_refund', { p_refund_id: refundId })
  assert(!error, `approve_refund failed: ${error?.message}`)

  const status = await getPaymentStatus(bookingId)
  assert(status === 'partial_refund', `expected 'partial_refund', got '${status}'`)
})

// ── Case 3: two refunds summing to full → 'refunded' ────────────────────
await step('Case 3: two refunds summing to full → refunded', async () => {
  const { ci, co } = dateRange(dateSlot++, 2)
  const bookingId = await createBooking(ci, co)
  await createPayment(bookingId, 5000)
  const r1 = await createRefundRequest(bookingId, 3000)
  const r2 = await createRefundRequest(bookingId, 2000)

  // Approve first → partial_refund
  await svc.rpc('approve_refund', { p_refund_id: r1 })
  const statusAfterFirst = await getPaymentStatus(bookingId)
  assert(statusAfterFirst === 'partial_refund', `after r1 expected 'partial_refund', got '${statusAfterFirst}'`)

  // Approve second → refunded (3000 + 2000 = 5000)
  await svc.rpc('approve_refund', { p_refund_id: r2 })
  const statusAfterSecond = await getPaymentStatus(bookingId)
  assert(statusAfterSecond === 'refunded', `after r2 expected 'refunded', got '${statusAfterSecond}'`)
})

// ── Case 4: two refunds summing to partial → 'partial_refund' ────────────
await step('Case 4: two refunds summing to partial → partial_refund', async () => {
  const { ci, co } = dateRange(dateSlot++, 2)
  const bookingId = await createBooking(ci, co)
  await createPayment(bookingId, 5000)
  const r1 = await createRefundRequest(bookingId, 1500)
  const r2 = await createRefundRequest(bookingId, 1500)

  await svc.rpc('approve_refund', { p_refund_id: r1 })
  const s1 = await getPaymentStatus(bookingId)
  assert(s1 === 'partial_refund', `after r1 expected 'partial_refund', got '${s1}'`)

  await svc.rpc('approve_refund', { p_refund_id: r2 })
  const s2 = await getPaymentStatus(bookingId)
  assert(s2 === 'partial_refund', `after r2 (still 3000 < 5000) expected 'partial_refund', got '${s2}'`)
})

// ── Case 5: third refund flips partial → refunded ────────────────────────
await step('Case 5: third refund (2000) tips aggregate to full → refunded', async () => {
  // Reuse case 4's pattern in a fresh booking
  const { ci, co } = dateRange(dateSlot++, 2)
  const bookingId = await createBooking(ci, co)
  await createPayment(bookingId, 5000)
  const r1 = await createRefundRequest(bookingId, 1500)
  const r2 = await createRefundRequest(bookingId, 1500)
  const r3 = await createRefundRequest(bookingId, 2000)

  await svc.rpc('approve_refund', { p_refund_id: r1 })
  await svc.rpc('approve_refund', { p_refund_id: r2 })
  const s2 = await getPaymentStatus(bookingId)
  assert(s2 === 'partial_refund', `after 2 refunds expected 'partial_refund', got '${s2}'`)

  await svc.rpc('approve_refund', { p_refund_id: r3 })
  const s3 = await getPaymentStatus(bookingId)
  assert(s3 === 'refunded', `after 3rd refund (total 5000) expected 'refunded', got '${s3}'`)
})

// ── Case 6: idempotency — re-approving a refund throws ──────────────────
await step('Case 6: re-approving an already-decided refund throws', async () => {
  const { ci, co } = dateRange(dateSlot++, 2)
  const bookingId = await createBooking(ci, co)
  await createPayment(bookingId, 5000)
  const refundId = await createRefundRequest(bookingId, 5000)

  // First approval succeeds
  const { error: e1 } = await svc.rpc('approve_refund', { p_refund_id: refundId })
  assert(!e1, `first approve_refund failed: ${e1?.message}`)

  // Second approval throws (Phase 10 double-decision guard)
  const { error: e2, data: d2 } = await svc.rpc('approve_refund', { p_refund_id: refundId })
  assert(e2, 'expected error on second approve_refund call')
  assert(
    e2.message.includes('already decided'),
    `expected 'already decided' in error, got: ${e2.message}`,
  )
  // Status is still 'refunded' (the previous approval stands)
  const status = await getPaymentStatus(bookingId)
  assert(status === 'refunded', `expected 'refunded' (unchanged), got '${status}'`)
  void d2
})

// ── Case 7: confirm_refund_session aggregation ───────────────────────────
await step('Case 7: confirm_refund_session webhook aggregates with existing refund_requests', async () => {
  const { ci, co } = dateRange(dateSlot++, 2)
  const bookingId = await createBooking(ci, co)
  const payment = await createPayment(bookingId, 5000)

  // Pre-existing approved refund (3000) — webhook arrives for another full refund
  // of the same payment. The aggregation should sum to 3000 + 5000 = 8000 vs
  // payment 5000 → 'refunded'.
  const preRefund = await createRefundRequest(bookingId, 3000)
  await svc.rpc('approve_refund', { p_refund_id: preRefund })
  const sPre = await getPaymentStatus(bookingId)
  assert(sPre === 'partial_refund', `pre-webhook expected 'partial_refund', got '${sPre}'`)

  // Webhook arrives for the SAME payment_intent (this represents a second
  // Stripe refund issued outside our UI, e.g. via Stripe dashboard).
  const eventId = `evt_test_p19r19_${Math.random().toString(36).slice(2, 10)}`
  const { error: confirmErr } = await svc.rpc('confirm_refund_session', {
    p_payment_intent: payment.provider_payment_id,
    p_event_id: eventId,
  })
  assert(!confirmErr, `confirm_refund_session failed: ${confirmErr?.message}`)

  // The webhook added the full payment amount (5000) to the aggregate.
  // 3000 (existing refund) + 5000 (this webhook) = 8000 vs paid 5000 → 'refunded'
  const status = await getPaymentStatus(bookingId)
  assert(status === 'refunded', `after webhook expected 'refunded', got '${status}'`)
})

// ── Cleanup before exit ────────────────────────────────────────────────
await cleanup()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
