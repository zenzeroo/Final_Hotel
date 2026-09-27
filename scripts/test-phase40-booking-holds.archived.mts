/**
 * Phase 40 — booking_holds integration test (ARCHIVED).
 *
 * ──────────────────────────────────────────────────────────────────
 * ⚠️  SUPERSEDED by Phase 42 — Temp Pending Bookings.
 * ──────────────────────────────────────────────────────────────────
 *
 * This script tested the Phase 40 booking_holds mechanism (a separate
 * `booking_holds` table with 10-min TTL). Phase 42 replaced that table with
 * real `bookings` rows in `status='temp_pending'` + a `hold_expires_at`
 * column. See `scripts/test-phase42-temp-pending.mts` for the new test.
 *
 * The booking_holds table was dropped in migration
 * `20261004_3_drop_booking_holds.sql` (2026-10-04), so this script can
 * no longer run against live DB without re-creating the table. KEPT for
 * reference of the original test patterns (concurrency tests, ON CONFLICT
 * DO UPDATE verification, EXCLUDE constraint interaction, etc.).
 *
 * DO NOT DELETE — useful as historical reference for future RPC patterns
 * that need to verify race-safety + atomic capacity checks.
 *
 * ──────────────────────────────────────────────────────────────────
 *
 * Original purpose (Phase 40):
 *   Verifies the 10-minute hold mechanism:
 *   1. User A acquires hold for room_type X + dates → booking_holds row
 *      created with expires_at ~10min in the future.
 *   2. While A's hold is active, searchRooms filterByAvailability hides
 *      room_type X (admin client global view counts the hold).
 *   3. User B tries to create_booking for same dates → P0001
 *      (RPC counts A's hold in combined capacity check).
 *   4. User A re-acquires for same dates → expires_at extends
 *      (ON CONFLICT DO UPDATE; no error, no second row).
 *   5. Hold expires (manually set expires_at = past) → searchRooms
 *      shows the room again.
 *   6. A acquires + create_booking succeeds → RPC atomically
 *      DELETEs A's hold for those dates.
 *
 * Prereqs (HAVE BEEN DROPPED):
 *   - Migration 20261003_booking_holds.sql applied (SUPERSEDED)
 *   - Live seed has at least one room_type with one room_unit
 *   - test@zenzero.com fixture exists (run scripts/_rbac-fixture.mts)
 *
 * Cleanup: booking_code prefix `ZZR-P40H-*` for created bookings;
 *          holds are deleted by id (cleanup before + after each run).
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

// Fixtures — pick a stable room_type with one room_unit, and a second test
// user (for the "user B tries to book" case).
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

const { data: usersList } = await svc.auth.admin.listUsers()
const testUserA = usersList?.users.find((u) => u.email === 'test@zenzero.com')
const testUserB = usersList?.users.find((u) => u.email === 'test-manager@zenzero.com')
  ?? usersList?.users.find((u) => u.email !== 'test@zenzero.com')
if (!testUserA || !testUserB) {
  console.error('Need at least 2 test users — run scripts/_rbac-fixture.mts')
  process.exit(1)
}
const userAId = testUserA.id
const userBId = testUserB.id
console.log(`User A: ${userAId} (${testUserA.email})`)
console.log(`User B: ${userBId} (${testUserB.email})`)

// Far-future date range (avoids colliding with real bookings + holds).
const PREFIX = 'ZZR-P40H-'
const D1 = '2031-07-01'
const D2 = '2031-07-05' // 4 nights

// Cleanup before tests — both bookings + any holds for these dates.
async function cleanupAll() {
  await svc.from('bookings').delete().like('booking_code', `${PREFIX}%`)
  await svc
    .from('booking_holds')
    .delete()
    .eq('check_in', D1)
    .eq('check_out', D2)
}
await cleanupAll()

function bookingParams(userId: string) {
  return {
    p_user_id: userId,
    p_room_type_id: roomType.id,
    p_check_in: D1,
    p_check_out: D2,
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
    p_booker_full_name: 'Hold Test',
    p_booker_email: 'test@zenzero.com',
    p_booker_phone: '0890000001',
    p_special_request: null,
    p_channel: 'web' as const,
    p_booking_code: `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

// Mirror filterByAvailability's hold query — admin client reads active holds
// (any user) for these dates.
async function countActiveHolds(): Promise<number> {
  const { count } = await svc
    .from('booking_holds')
    .select('id', { count: 'exact', head: true })
    .eq('room_type_id', roomType.id)
    .eq('check_in', D1)
    .eq('check_out', D2)
    .gt('expires_at', new Date().toISOString())
  return count ?? 0
}

let holdAId: string | null = null
let holdAExpiresAt: string | null = null

await step('1. User A acquires hold → row created with expires_at ~10min ahead', async () => {
  const { data, error } = await svc
    .from('booking_holds')
    .insert({
      user_id: userAId,
      room_type_id: roomType.id,
      check_in: D1,
      check_out: D2,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select()
    .single()
  assert(!error, `insert error: ${error?.message}`)
  assert(data, 'no row returned')
  holdAId = (data as { id: string }).id
  holdAExpiresAt = (data as { expires_at: string }).expires_at

  const ttlMs = new Date(holdAExpiresAt).getTime() - Date.now()
  assert(ttlMs > 9 * 60 * 1000 && ttlMs <= 10 * 60 * 1000 + 1000, `TTL out of range: ${ttlMs}ms`)
  return `id=${holdAId.slice(0, 8)} TTL=${Math.round(ttlMs / 1000)}s`
})

await step('2. While A holds, searchRooms counts the hold', async () => {
  const n = await countActiveHolds()
  assert(n === 1, `expected 1 active hold, got ${n}`)
})

await step('3. User B tries create_booking → P0001 (hold blocks)', async () => {
  const { error } = await svc.rpc('create_booking', bookingParams(userBId))
  assert(error, 'expected error but RPC succeeded')
  assert(error.code === 'P0001', `expected P0001, got ${error.code}: ${error.message}`)
  return `P0001: ${error.message.split('.')[0]}`
})

await step('4. User A re-acquires → expires_at extends (ON CONFLICT)', async () => {
  assert(holdAId, 'no prior hold id')
  const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { data, error } = await svc
    .from('booking_holds')
    .upsert(
      {
        user_id: userAId,
        room_type_id: roomType.id,
        check_in: D1,
        check_out: D2,
        expires_at: newExpiresAt,
      },
      { onConflict: 'user_id,room_type_id,check_in,check_out' },
    )
    .select()
    .single()
  assert(!error, `upsert error: ${error?.message}`)
  assert(data, 'no row returned')

  // Verify only ONE row exists for (A, room_type, dates) — full unique index
  // ensures no duplicate from ON CONFLICT.
  const { count } = await svc
    .from('booking_holds')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userAId)
    .eq('room_type_id', roomType.id)
    .eq('check_in', D1)
    .eq('check_out', D2)
  assert(count === 1, `expected 1 row, got ${count}`)
  return `TTL refreshed, count=${count}`
})

await step('5. Hold expires (manually set expires_at = past) → searchRooms counts 0', async () => {
  assert(holdAId, 'no hold id')
  // Backdate the existing hold so it counts as expired.
  const { error } = await svc
    .from('booking_holds')
    .update({ expires_at: new Date(Date.now() - 60 * 1000).toISOString() })
    .eq('id', holdAId)
  assert(!error, `update error: ${error?.message}`)

  const n = await countActiveHolds()
  assert(n === 0, `expected 0 active holds, got ${n}`)
})

await step('6. After expiry, User B create_booking succeeds (RPC)', async () => {
  // Restore the hold with a fresh expiry so we can test step 7 below.
  // (Step 6 is really testing the inverse of step 5 — after TTL the
  // slot is available. We don't actually need to create B's booking;
  // we just confirm the RPC accepts an A-style booking now that the
  // hold is expired.)
  const { data, error } = await svc.rpc('create_booking', bookingParams(userBId))
  assert(!error, `RPC error: ${error?.message}`)
  assert(data, 'no booking id returned')

  // Cleanup B's booking so step 7 can use A.
  await svc.from('bookings').delete().eq('id', data as string)
  return `B booking created then cleaned up`
})

await step('7. User A acquires + create_booking → RPC atomically DELETEs A hold', async () => {
  // Mirror production acquireHold() — DELETE any expired rows for this
  // user before re-acquiring. Step 5 backdated the existing row, but
  // the row itself wasn't removed, so a plain INSERT would hit the full
  // unique index. The app layer's cleanup-delete is what makes the
  // production flow work.
  await svc
    .from('booking_holds')
    .delete()
    .eq('user_id', userAId)
    .eq('room_type_id', roomType.id)
    .eq('check_in', D1)
    .eq('check_out', D2)
    .lt('expires_at', new Date().toISOString())

  // Acquire fresh hold for A.
  const { data: hold, error: insertErr } = await svc
    .from('booking_holds')
    .insert({
      user_id: userAId,
      room_type_id: roomType.id,
      check_in: D1,
      check_out: D2,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select()
    .single()
  assert(!insertErr, `insert error: ${insertErr?.message}`)
  assert(hold, 'no hold row')

  // A creates booking → RPC should DELETE A's hold for these dates.
  const { data: bookingId, error } = await svc.rpc('create_booking', bookingParams(userAId))
  assert(!error, `RPC error: ${error?.message}`)
  assert(bookingId, 'no booking id')

  const { count } = await svc
    .from('booking_holds')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userAId)
    .eq('room_type_id', roomType.id)
    .eq('check_in', D1)
    .eq('check_out', D2)
  assert(count === 0, `expected 0 holds after booking, got ${count}`)
  return `booking=${(bookingId as string).slice(0, 8)}, holds=${count}`
})

// ── Final cleanup ──
await cleanupAll()

console.log(`\nSummary: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
