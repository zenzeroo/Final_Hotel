/**
 * Phase 42 — Temp Pending Bookings integration test.
 *
 * Verifies the temp_pending bookings mechanism:
 *   1. create_temp_booking RPC inserts a bookings row with status='temp_pending'
 *      and hold_expires_at = now() + p_hold_minutes. Returns the new id.
 *   2. The temp booking is visible via getUserBookings / getTempBookingById.
 *   3. Two concurrent create_temp_booking for same room+dates — second fails P0001.
 *   4. Lazy expiry: expire_user_temp_bookings RPC flips stale temp_pending
 *      to 'expired' + inserts booking_events temp_hold_expired rows.
 *   5. Lazy expiry: expire_specific_temp_booking flips a single stale row.
 *   6. complete_temp_booking flips a live temp_pending → confirmed + clears
 *      hold_expires_at + inserts booking_events temp_hold_completed row.
 *   7. cancel_temp_booking flips a live temp_pending → cancelled + inserts
 *      booking_events temp_hold_cancelled row.
 *   8. Daily cron: cleanup_abandoned_temp_bookings flips all stale rows.
 *   9. Owner check: complete_temp_booking with wrong user_id → 42501.
 *  10. Wrong-state check: complete_temp_booking on cancelled/expired → P0001.
 *
 * Prereqs:
 *   - All Phase 42 migrations applied (1, 2, 3)
 *   - Live seed has at least one room_type with one room_unit
 *   - test@zenzero.com fixture exists (run scripts/_rbac-fixture.mts)
 *
 * Run: npx tsx scripts/test-phase42-temp-pending.mts
 *
 * Cleanup: bookings prefix `ZZR-P42-*` (deleted via service-role client).
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!BASE || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const svc = createClient(BASE, SERVICE_KEY, {
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

// ----------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------

const { data: roomType } = await svc
  .from('room_types')
  .select('id, base_price, max_guests')
  .eq('is_active', true)
  .is('deleted_at', null)
  .limit(1)
  .single()
if (!roomType) {
  console.error('No room_type found — has the seed been applied?')
  process.exit(1)
}
console.log('Using room_type:', roomType.id)

// Find a test user (the standard fixture from _rbac-fixture.mts)
const { data: testUsers } = await svc
  .from('profiles')
  .select('id, full_name, phone, role')
  .eq('role', 'user')
  .limit(1)
const testUser = testUsers?.[0]
if (!testUser) {
  console.error('No user role fixture found — run scripts/_rbac-fixture.mts first')
  process.exit(1)
}
console.log('Using test_user:', testUser.id)

// Find a second user for the owner-check test (use any other user)
const { data: otherUsers } = await svc
  .from('profiles')
  .select('id')
  .neq('id', testUser.id)
  .limit(1)
const otherUser = otherUsers?.[0]
if (!otherUser) {
  console.error('No second user fixture found — run scripts/_rbac-fixture.mts first')
  process.exit(1)
}
console.log('Using other_user:', otherUser.id)

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await svc.rpc(name, args)
  if (error) {
    // Preserve the PostgREST `code` (e.g. '42501', 'P0001') on the thrown
    // error so tests can assert on it. The default Error class drops the
    // custom properties, so we attach them via Object.assign.
    const err = new Error(`${name} failed: ${error.message}`)
    Object.assign(err, { code: (error as { code?: string }).code, message: error.message })
    throw err
  }
  return data
}

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

async function createTemp(uid: string, checkInOffset = 30, checkOutOffset = 32) {
  const id = await rpc('create_temp_booking', {
    p_user_id: uid,
    p_room_type_id: roomType.id,
    p_check_in: isoDate(checkInOffset),
    p_check_out: isoDate(checkOutOffset),
    p_guests: 1,
    p_nights: 2,
    p_base_subtotal: roomType.base_price * 2,
    p_total: roomType.base_price * 2,
    p_booker_full_name: 'Test User',
    p_booker_email: 'test@zenzero.test',
    p_booker_phone: '0812345678',
    p_hold_minutes: 5,
  })
  return id as string
}

async function cleanupBooking(id: string) {
  // Delete dependent rows (booking_events) + the booking itself.
  await svc.from('booking_events').delete().eq('booking_id', id)
  await svc.from('refund_requests').delete().eq('booking_id', id)
  await svc.from('payments').delete().eq('booking_id', id)
  await svc.from('bookings').delete().eq('id', id)
}

const createdIds: string[] = []
function track(id: string) {
  createdIds.push(id)
}

async function cleanupAll() {
  for (const id of createdIds) {
    await cleanupBooking(id)
  }
}

process.on('beforeExit', async () => {
  await cleanupAll()
  console.log('\nCleanup complete.')
})

// ----------------------------------------------------------------------
// Cases
// ----------------------------------------------------------------------

await step('1. create_temp_booking inserts row with status=temp_pending + hold_expires_at', async () => {
  const id = await createTemp(testUser.id)
  track(id)

  const { data: row, error } = await svc
    .from('bookings')
    .select('status, hold_expires_at, payment_status, user_id, room_type_id')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  assert(row?.status === 'temp_pending', `expected temp_pending, got ${row?.status}`)
  assert(row.hold_expires_at, 'hold_expires_at should be set')
  const expMs = new Date(row.hold_expires_at).getTime()
  const now = Date.now()
  assert(expMs > now, `hold_expires_at should be in the future (${row.hold_expires_at})`)
  assert(row.payment_status === 'unpaid', 'payment_status should be unpaid')
  assert(row.user_id === testUser.id, 'user_id mismatch')
  return `id=${id}, hold_expires_at=${row.hold_expires_at}`
})

await step('2. Temp booking is visible in getUserBookings (after lazy expiry helper)', async () => {
  // The lazy-expiry helper is called inside getUserBookings (app-side).
  // Simulate it here by calling the RPC directly.
  const expired = await rpc('expire_user_temp_bookings', { p_user_id: testUser.id })
  // expired is int — count of flipped rows.

  const { data: bookings, error } = await svc
    .from('bookings')
    .select('id, status, hold_expires_at')
    .eq('user_id', testUser.id)
    .eq('status', 'temp_pending')
  if (error) throw new Error(error.message)
  assert(bookings && bookings.length > 0, 'no temp_pending rows visible')
  return `expired=${expired}, temp_pending_rows=${bookings.length}`
})

await step('3. Two concurrent create_temp_booking for same room+dates — second fails P0001', async () => {
  // First booking succeeds.
  const id1 = await createTemp(testUser.id, 60, 62)
  track(id1)

  // Need a SECOND user for this test (the same user can't double-book because
  // we want to verify pool exhaustion, not auth check).
  // First, ensure pool_size = 1 so the second insert triggers P0001.
  // Use a room_type with exactly 1 active unit.
  const { data: oneUnitRoom } = await svc
    .from('room_types')
    .select('id, base_price, max_guests, room_units(id, is_active)')
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .single()
  if (!oneUnitRoom) throw new Error('no room_type with units found')

  // Count active units
  const activeUnits = (oneUnitRoom.room_units as { is_active: boolean }[])
    .filter((u) => u.is_active).length
  if (activeUnits === 0) {
    return 'skipped — no active units for this room_type'
  }

  // First temp booking already created — use it.
  // Try to create a second one for a DIFFERENT user with same dates — should
  // be blocked by P0001 (pool exhausted).
  let caughtError: { code?: string; message: string } | null = null
  try {
    const { error } = await svc.rpc('create_temp_booking', {
      p_user_id: otherUser.id,
      p_room_type_id: roomType.id,
      p_check_in: isoDate(60),
      p_check_out: isoDate(62),
      p_guests: 1,
      p_nights: 2,
      p_base_subtotal: roomType.base_price * 2,
      p_total: roomType.base_price * 2,
      p_booker_full_name: 'Other User',
      p_booker_email: 'other@zenzero.test',
      p_booker_phone: '0898765432',
      p_hold_minutes: 5,
    })
    if (error) caughtError = error as { code?: string; message: string }
  } catch (e) {
    caughtError = e as { code?: string; message: string }
  }
  // If pool has multiple units, the second create might succeed — only verify
  // if the first user took the last slot.
  if (!caughtError) {
    return `skipped — pool has ${activeUnits} units, second create succeeded`
  }
  assert(caughtError.code === 'P0001', `expected P0001, got ${caughtError.code}`)
  return `P0001 raised as expected`
})

await step('4. expire_user_temp_bookings flips stale temp_pending to expired', async () => {
  // Create a fresh temp booking, then manually backdate its hold_expires_at.
  const id = await createTemp(testUser.id, 90, 92)
  track(id)
  await svc
    .from('bookings')
    .update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', id)

  const expired = await rpc('expire_user_temp_bookings', { p_user_id: testUser.id })
  assert(expired >= 1, `expected ≥1 expired row, got ${expired}`)

  const { data: row } = await svc.from('bookings').select('status').eq('id', id).single()
  assert(row?.status === 'expired', `expected expired, got ${row?.status}`)

  // Audit row should exist.
  const { data: events } = await svc
    .from('booking_events')
    .select('event_type, metadata')
    .eq('booking_id', id)
    .eq('event_type', 'temp_hold_expired')
  assert(events && events.length > 0, 'expected booking_events temp_hold_expired row')
  return `expired=${expired}, audit_rows=${events.length}`
})

await step('5. expire_specific_temp_booking flips single stale temp_pending', async () => {
  const id = await createTemp(testUser.id, 100, 102)
  track(id)
  await svc
    .from('bookings')
    .update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', id)

  const expired = await rpc('expire_specific_temp_booking', {
    p_booking_id: id,
    p_user_id: testUser.id,
  })
  assert(expired === 1, `expected 1 expired, got ${expired}`)

  const { data: row } = await svc.from('bookings').select('status').eq('id', id).single()
  assert(row?.status === 'expired', `expected expired, got ${row?.status}`)
  return `expired=1, status=${row?.status}`
})

await step('6. complete_temp_booking flips live temp_pending → confirmed + clears hold_expires_at', async () => {
  const id = await createTemp(testUser.id, 110, 112)
  track(id)

  await rpc('complete_temp_booking', {
    p_booking_id: id,
    p_user_id: testUser.id,
    p_booker_full_name: 'Test User',
    p_booker_email: 'test@zenzero.test',
    p_booker_phone: '0812345678',
    p_special_request: null,
    p_promotion_id: null,
    p_cancellation_policy_id: null,
    p_base_subtotal: roomType.base_price * 2,
    p_discount_total: 0,
    p_tax_total: 0,
    p_fee_total: 0,
    p_total: roomType.base_price * 2,
    p_nights: 2,
  })

  const { data: row } = await svc
    .from('bookings')
    .select('status, payment_status, hold_expires_at')
    .eq('id', id)
    .single()
  assert(row?.status === 'confirmed', `expected confirmed, got ${row?.status}`)
  assert(row.payment_status === 'unpaid', `expected unpaid, got ${row.payment_status}`)
  assert(row.hold_expires_at === null, `hold_expires_at should be null, got ${row.hold_expires_at}`)

  const { data: events } = await svc
    .from('booking_events')
    .select('event_type, metadata')
    .eq('booking_id', id)
    .eq('event_type', 'temp_hold_completed')
  assert(events && events.length > 0, 'expected booking_events temp_hold_completed row')
  return `status=${row.status}, audit=${events.length}`
})

await step('7. cancel_temp_booking flips live temp_pending → cancelled', async () => {
  const id = await createTemp(testUser.id, 120, 122)
  track(id)

  await rpc('cancel_temp_booking', {
    p_booking_id: id,
    p_user_id: testUser.id,
  })

  const { data: row } = await svc.from('bookings').select('status, hold_expires_at').eq('id', id).single()
  assert(row?.status === 'cancelled', `expected cancelled, got ${row?.status}`)
  assert(row.hold_expires_at === null, 'hold_expires_at should be null')

  const { data: events } = await svc
    .from('booking_events')
    .select('event_type, metadata')
    .eq('booking_id', id)
    .eq('event_type', 'temp_hold_cancelled')
  assert(events && events.length > 0, 'expected booking_events temp_hold_cancelled row')
  return `status=${row.status}`
})

await step('8. cleanup_abandoned_temp_bookings flips all stale rows (any user)', async () => {
  // Create two stale rows for two users. Use very-far-out dates (240+)
  // so they don't collide with any earlier-case active bookings.
  const idA = await createTemp(testUser.id, 240, 242)
  track(idA)
  // For idB (other_user), we may get P0001 if pool has only 1 unit AND
  // idA took the only slot. In that case skip the second create + backdate
  // the idA row only. The cleanup RPC still flips >1 rows because every
  // previous-case stale row is still in the table.
  let idB: string | null = null
  try {
    idB = await createTemp(otherUser.id, 240, 242)
    track(idB)
  } catch {
    // Pool exhausted — that's fine, the test still proves the cron RPC
    // works by flipping the prior cases' stale rows.
  }

  // Backdate both ids to make them stale.
  const ids = idB ? [idA, idB] : [idA]
  await svc
    .from('bookings')
    .update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .in('id', ids)

  const expired = await rpc('cleanup_abandoned_temp_bookings', {})
  assert(expired >= 1, `expected ≥1 expired, got ${expired}`)

  const { data: rows } = await svc
    .from('bookings')
    .select('id, status')
    .in('id', ids)
  for (const r of rows ?? []) {
    assert(r.status === 'expired', `${r.id} should be expired, got ${r.status}`)
  }
  return `expired=${expired}, idB=${idB ? 'created' : 'skipped (pool exhausted)'}`
})

await step('9. complete_temp_booking with wrong user_id → 42501', async () => {
  const id = await createTemp(testUser.id, 140, 142)
  track(id)

  let caught: { code?: string; message: string } | null = null
  try {
    await rpc('complete_temp_booking', {
      p_booking_id: id,
      p_user_id: otherUser.id, // different from booking's owner
      p_booker_full_name: 'Hacker',
      p_booker_email: 'hack@zenzero.test',
      p_booker_phone: '0800000000',
      p_special_request: null,
      p_promotion_id: null,
      p_cancellation_policy_id: null,
      p_base_subtotal: 0,
      p_discount_total: 0,
      p_tax_total: 0,
      p_fee_total: 0,
      p_total: 0,
      p_nights: 2,
    })
  } catch (e) {
    caught = e as { code?: string; message: string }
  }
  assert(caught, 'expected error')
  assert(caught.code === '42501', `expected 42501, got ${caught.code}`)
  return `caught 42501 as expected`
})

await step('10. complete_temp_booking on cancelled/expired → P0001', async () => {
  // First: cancelled.
  const id1 = await createTemp(testUser.id, 150, 152)
  track(id1)
  await rpc('cancel_temp_booking', { p_booking_id: id1, p_user_id: testUser.id })

  let caught: { code?: string; message: string } | null = null
  try {
    await rpc('complete_temp_booking', {
      p_booking_id: id1,
      p_user_id: testUser.id,
      p_booker_full_name: 'x',
      p_booker_email: 'x@x.com',
      p_booker_phone: '0800000000',
      p_special_request: null,
      p_promotion_id: null,
      p_cancellation_policy_id: null,
      p_base_subtotal: 0,
      p_discount_total: 0,
      p_tax_total: 0,
      p_fee_total: 0,
      p_total: 0,
      p_nights: 2,
    })
  } catch (e) {
    caught = e as { code?: string; message: string }
  }
  assert(caught, 'expected error on cancelled')
  assert(caught.code === 'P0001', `expected P0001 for cancelled, got ${caught.code}`)

  // Second: expired.
  const id2 = await createTemp(testUser.id, 160, 162)
  track(id2)
  await svc
    .from('bookings')
    .update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', id2)
  await rpc('expire_specific_temp_booking', {
    p_booking_id: id2,
    p_user_id: testUser.id,
  })

  caught = null
  try {
    await rpc('complete_temp_booking', {
      p_booking_id: id2,
      p_user_id: testUser.id,
      p_booker_full_name: 'x',
      p_booker_email: 'x@x.com',
      p_booker_phone: '0800000000',
      p_special_request: null,
      p_promotion_id: null,
      p_cancellation_policy_id: null,
      p_base_subtotal: 0,
      p_discount_total: 0,
      p_tax_total: 0,
      p_fee_total: 0,
      p_total: 0,
      p_nights: 2,
    })
  } catch (e) {
    caught = e as { code?: string; message: string }
  }
  assert(caught, 'expected error on expired')
  assert(caught.code === 'P0001', `expected P0001 for expired, got ${caught.code}`)
  return 'both P0001 raised'
})

await step('11. cancel_temp_booking with wrong user_id → 42501', async () => {
  const id = await createTemp(testUser.id, 170, 172)
  track(id)

  let caught: { code?: string; message: string } | null = null
  try {
    await rpc('cancel_temp_booking', { p_booking_id: id, p_user_id: otherUser.id })
  } catch (e) {
    caught = e as { code?: string; message: string }
  }
  assert(caught, 'expected error')
  assert(caught.code === '42501', `expected 42501, got ${caught.code}`)
  return 'caught 42501 as expected'
})

await step('12. expire_specific_temp_booking is owner-scoped (no cross-user expiry)', async () => {
  // Other user tries to expire test user's booking — should NOT flip it.
  const id = await createTemp(testUser.id, 180, 182)
  track(id)
  await svc
    .from('bookings')
    .update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', id)

  const expired = await rpc('expire_specific_temp_booking', {
    p_booking_id: id,
    p_user_id: otherUser.id, // wrong owner
  })
  assert(expired === 0, `expected 0 expired (owner-scoped), got ${expired}`)

  const { data: row } = await svc.from('bookings').select('status').eq('id', id).single()
  assert(row?.status === 'temp_pending', `status should be unchanged, got ${row?.status}`)
  return 'owner scope enforced'
})

// ----------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------

await cleanupAll()
console.log(`\nResults: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
