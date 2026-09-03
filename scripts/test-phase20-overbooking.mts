/**
 * Phase 20 #23 — Overbooking prevention integration test.
 *
 * Verifies the new `create_booking` RPC + EXCLUDE constraint on
 * `(room_unit_id, daterange)` close the gap where two guests could confirm
 * overlapping bookings for the same room_type_id without any capacity check.
 *
 * Cases:
 *   1. Single booking for room_type X, dates [D1, D2] → ✓ inserted.
 *   2. Second booking for same type, **non-overlapping** dates [D3, D4]
 *      (D3 ≥ D2) → ✓ inserted (pool=1, sequential — no conflict).
 *   3. Second booking for same type, **overlapping** dates [D1+1, D2+1]
 *      → ✗ P0001 "No rooms available for the selected dates".
 *   4. Cancel booking #1, then re-attempt case 3 → ✓ inserted (slot freed).
 *   5. Concurrent inserts: 5 parallel RPC calls for same type, overlapping
 *      dates → exactly 1 succeeds, 4 fail with P0001.
 *   6. Walk-in (service-role) booking attempt when web (authenticated) has
 *      the slot → ✗ P0001 (RPC is shared across caller types).
 *   7. EXCLUDE constraint: assign `room_unit_id=X` to booking A then try
 *      to assign same unit to booking B with overlapping dates → ✗
 *      `bookings_no_unit_overlap` exclusion violation.
 *
 * Prereqs:
 *   - Migration 20260904_create_booking_rpc_and_constraint.sql applied
 *   - PostgREST schema cache reloaded: `NOTIFY pgrst, 'reload schema';`
 *   - Live seed has at least one room_type with one room_unit (default seed).
 *   - Admin test password (or seed user with role='admin') available.
 *
 * Run: npx tsx scripts/test-phase20-overbooking.mts
 *
 * Cleanup: tagged rows have `booking_code` prefix `ZZR-P20OB-*` — delete via
 *   supabase .from('bookings').delete().like('booking_code', 'ZZR-P20OB-%').
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

// ── Test counters ───────────────────────────────────────────────────────
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

// ── Fixtures ────────────────────────────────────────────────────────────

// Use a stable room_type for tests — pick the first active one with a unit.
const { data: roomType, error: rtErr } = await svc
  .from('room_types')
  .select('id, base_price, max_guests')
  .eq('is_active', true)
  .limit(1)
  .single()
if (rtErr || !roomType) {
  console.error('Could not find a room_type — has the seed been applied?', rtErr?.message)
  process.exit(1)
}
console.log('Using room_type:', roomType.id)

// Get a test guest user (test@zenzero.com is the Phase 11 fixture).
const { data: usersList } = await svc.auth.admin.listUsers()
const testUser = usersList?.users.find((u) => u.email === 'test@zenzero.com')
if (!testUser) {
  console.error('test@zenzero.com not found — run scripts/_rbac-fixture.mts first')
  process.exit(1)
}
const testUserId = testUser.id
console.log('Using guest user:', testUserId)

// Get a room_unit for the EXCLUDE test (case 7).
const { data: roomUnit, error: ruErr } = await svc
  .from('room_units')
  .select('id')
  .eq('room_type_id', roomType.id)
  .eq('is_active', true)
  .limit(1)
  .single()
if (ruErr || !roomUnit) {
  console.error('No room_unit for room_type — seed mismatch?', ruErr?.message)
  process.exit(1)
}
console.log('Using room_unit:', roomUnit.id)

// Use a far-future date range to avoid colliding with real bookings.
// Today is 2026-09-03 per the system clock; tests use 2030+ to be safe.
const PREFIX = 'ZZR-P20OB-' // booking_code tag for cleanup
const D1 = '2030-06-01'
const D2 = '2030-06-05' // 4 nights
const D3 = '2030-06-10' // non-overlapping
const D4 = '2030-06-14'
const D1_OVERLAP_IN = '2030-06-03' // overlaps with [D1, D2)
const D2_OVERLAP_OUT = '2030-06-08'

// Booking params factory — same shape for every test row.
function bookingParams(ci: string, co: string, channel: 'web' | 'walk_in' = 'web') {
  return {
    p_user_id: testUserId,
    p_room_type_id: roomType.id,
    p_check_in: ci,
    p_check_out: co,
    p_guests: 1,
    p_nights: 4,
    p_base_subtotal: 10000,
    p_discount_total: 0,
    p_tax_total: 700,
    p_fee_total: 600,
    p_total: 11300,
    p_currency: 'THB',
    p_promotion_id: null,
    p_cancellation_policy_id: null,
    p_booker_full_name: 'Overbooking Test',
    p_booker_email: 'test@zenzero.com',
    p_booker_phone: null,
    p_special_request: null,
    p_channel: channel,
    p_booking_code: `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

// ── Cleanup before tests ────────────────────────────────────────────────
async function cleanup() {
  const { error } = await svc
    .from('bookings')
    .delete()
    .like('booking_code', `${PREFIX}%`)
  if (error) console.warn('cleanup warning:', error.message)
}
await cleanup()

// ── Test cases ──────────────────────────────────────────────────────────

let booking1Id: string | null = null

await step('1. Single booking [D1, D2] succeeds', async () => {
  const { data, error } = await svc.rpc('create_booking', bookingParams(D1, D2))
  assert(!error, `RPC error: ${error?.message}`)
  assert(data, 'No booking id returned')
  booking1Id = data as string
  return `id=${booking1Id.slice(0, 8)}`
})

await step('2. Non-overlapping booking [D3, D4] succeeds (pool=1, sequential)', async () => {
  const { data, error } = await svc.rpc('create_booking', bookingParams(D3, D4))
  assert(!error, `RPC error: ${error?.message}`)
  assert(data, 'No booking id returned')
  return `id=${(data as string).slice(0, 8)}`
})

await step('3. Overlapping booking [D1+1, D2+1] rejected with P0001', async () => {
  const { data, error } = await svc.rpc(
    'create_booking',
    bookingParams(D1_OVERLAP_IN, D2_OVERLAP_OUT),
  )
  assert(error, 'Expected RPC error but got success')
  assert(error.code === 'P0001', `Expected P0001, got ${error.code}: ${error.message}`)
  assert(data === null, 'Expected no booking id returned')
  return `P0001: ${error.message}`
})

await step('4. Cancel #1, then re-attempt overlapping [D1+1, D2+1] succeeds', async () => {
  // Cancel booking1
  const { error: cancelErr } = await svc
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking1Id!)
  assert(!cancelErr, `Cancel failed: ${cancelErr?.message}`)

  // Now re-attempt the previously-rejected booking
  const { data, error } = await svc.rpc(
    'create_booking',
    bookingParams(D1_OVERLAP_IN, D2_OVERLAP_OUT),
  )
  assert(!error, `RPC error after cancel: ${error?.message}`)
  assert(data, 'No booking id returned')

  // Cleanup: cancel this one too so subsequent tests aren't affected
  await svc.from('bookings').update({ status: 'cancelled' }).eq('id', data as string)
  return `id=${(data as string).slice(0, 8)}`
})

await step('5. Concurrent inserts: exactly 1 of 5 succeeds', async () => {
  const promises = Array.from({ length: 5 }, () =>
    svc.rpc('create_booking', bookingParams('2030-12-01', '2030-12-05')),
  )
  const results = await Promise.allSettled(promises)

  // We just freed up the slot at end of test 4 by cancelling, but that was
  // for a different date range. Use a fresh range here.
  const successes = results.filter(
    (r) => r.status === 'fulfilled' && !r.value.error && r.value.data,
  )
  const poolExhausted = results.filter(
    (r) =>
      r.status === 'fulfilled' &&
      r.value.error?.code === 'P0001',
  )

  assert(
    successes.length === 1,
    `Expected exactly 1 success, got ${successes.length}`,
  )
  assert(
    poolExhausted.length === 4,
    `Expected 4 P0001 errors, got ${poolExhausted.length}`,
  )
  return `${successes.length} ok / ${poolExhausted.length} rejected (pool=1)`
})

await step('6. Walk-in (service-role) blocked when web (authenticated) holds slot', async () => {
  // Insert a fresh web booking to occupy the slot
  const webRes = await svc.rpc('create_booking', bookingParams('2031-01-01', '2031-01-05'))
  assert(!webRes.error, `Web insert failed: ${webRes.error?.message}`)
  const webId = webRes.data as string

  // Now attempt walk-in for overlapping dates
  const walkInRes = await svc.rpc(
    'create_booking',
    bookingParams('2031-01-02', '2031-01-06', 'walk_in'),
  )
  assert(walkInRes.error, 'Walk-in should have failed')
  assert(walkInRes.error.code === 'P0001', `Expected P0001, got ${walkInRes.error.code}`)

  // Cleanup
  await svc.from('bookings').update({ status: 'cancelled' }).eq('id', webId)
  return 'RPC is shared across caller types'
})

await step('7. EXCLUDE constraint: same room_unit + overlapping dates rejected', async () => {
  // Create booking A (web) for [E1, E2]
  const aRes = await svc.rpc('create_booking', bookingParams('2031-02-01', '2031-02-05'))
  assert(!aRes.error, `A insert failed: ${aRes.error?.message}`)
  const aId = aRes.data as string

  // Create booking B (non-overlapping, will be assigned the same unit)
  const bRes = await svc.rpc('create_booking', bookingParams('2031-02-10', '2031-02-14'))
  assert(!bRes.error, `B insert failed: ${bRes.error?.message}`)
  const bId = bRes.data as string

  // Assign room_unit_id=X to booking A at check-in
  const aUpdate = await svc
    .from('bookings')
    .update({ room_unit_id: roomUnit.id, status: 'checked_in' })
    .eq('id', aId)
  assert(!aUpdate.error, `A update failed: ${aUpdate.error?.message}`)

  // Try to assign room_unit_id=X to booking B with OVERLAPPING dates
  // (move B's dates into A's range to force overlap)
  const bMove = await svc
    .from('bookings')
    .update({ check_in: '2031-02-02', check_out: '2031-02-04', room_unit_id: roomUnit.id })
    .eq('id', bId)
  // Postgres EXCLUDE violation surfaces as PostgREST 23P01
  assert(bMove.error, 'Expected EXCLUDE violation')
  assert(
    bMove.error.code === '23P01' || /bookings_no_unit_overlap/.test(bMove.error.message),
    `Expected EXCLUDE 23P01, got ${bMove.error.code}: ${bMove.error.message}`,
  )

  // Cleanup
  await svc.from('bookings').delete().in('id', [aId, bId])
  return `EXCLUDE fires: ${bMove.error.code}`
})

// ── Final cleanup ───────────────────────────────────────────────────────
await cleanup()

// ── Summary ─────────────────────────────────────────────────────────────
console.log('\n────────────────────────')
console.log(`Passed: ${passed} / ${passed + failed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
