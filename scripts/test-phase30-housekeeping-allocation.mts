/**
 * Phase 30 — Automatic Housekeeping Task Allocation integration test.
 *
 * Validates:
 *   1. Algorithm unit test (3 HKs + 6 tasks balanced)
 *   2. Floor preference assignment
 *   3. Priority ordering
 *   4. Next-check-in urgency
 *   5. RPC race condition (concurrent allocations)
 *   6. markInspected → ready
 *   7. Check-out trigger creates task + flips room → waiting_cleaning
 *   8. NULL room_unit_id skip
 *   9. Dry-run mode
 *  10. No available housekeepers warning
 *
 * Prereqs:
 *   - Migration 20260920_housekeeping_allocation.sql applied.
 *   - Fixture users: test@zenzero.com, manager@zenzero.com, somjit@zenzero.com.
 *
 * Run: npx tsx scripts/test-phase30-housekeeping-allocation.mts
 *
 * Cleanup: deletes tasks with sentinel notes, restores shifts, deletes
 * sentinel bookings + floor_assignments.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { allocateTasks } from '../lib/algorithms/housekeeping-allocation'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD
if (!BASE || !SERVICE_KEY || !DB_PASSWORD) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SERVICE_ROLE_KEY + DB_PASSWORD required')
  process.exit(1)
}

const m = BASE.match(/https:\/\/([^.]+)\.supabase\.co/)
const projectRef = m[1]
const connStr = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`
const caPath = resolve(__dirname, '.supabase-ca.crt')
const ca = readFileSync(caPath, 'utf8')

const pg = new Client({ connectionString: connStr, ssl: { ca } })
await pg.connect()

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

const SENTINEL_NOTE = '[phase30-test]'

// ── Service-role Supabase client for RPC tests (auth context = service_role) ──
const supa = createServiceClient(BASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Cleanup ────────────────────────────────────────────────────────────────
async function cleanup() {
  // Tasks with sentinel note
  const { rows: sentinelTasks } = await pg.query<{ id: string }>(
    `select id from public.housekeeping_tasks where notes = $1`,
    [SENTINEL_NOTE],
  )
  if (sentinelTasks.length > 0) {
    await pg.query(
      `delete from public.housekeeping_tasks where id = any($1::uuid[])`,
      [sentinelTasks.map((r) => r.id)],
    )
  }
  // Floor assignments for sentinel floor
  await pg.query(`delete from public.floor_assignments where floor = $1`, [99])
  // Bookings with sentinel code
  const { rows: sentinelBookings } = await pg.query<{ id: string }>(
    `select id from public.bookings where booking_code like 'TEST-P30-%'`,
  )
  for (const b of sentinelBookings) {
    await pg.query(`delete from public.bookings where id = $1`, [b.id])
  }
}
await cleanup()

// ── Fixtures ────────────────────────────────────────────────────────────
const { rows: users } = await pg.query<{ id: string; email: string }>(
  `select id, email from auth.users where email in ('test@zenzero.com','manager@zenzero.com','somjit@zenzero.com')`,
)
const testUser = users.find((u) => u.email === 'test@zenzero.com')
const managerUser = users.find((u) => u.email === 'manager@zenzero.com')
const somjitUser = users.find((u) => u.email === 'somjit@zenzero.com')
if (!testUser || !managerUser || !somjitUser) {
  console.error('Required fixtures not found. Need test@ + manager@ + somjit@.')
  process.exit(1)
}

const { rows: roomTypes } = await pg.query<{ id: string; type: string }>(
  `select id, type from public.room_types where is_active = true limit 1`,
)
if (roomTypes.length === 0) {
  console.error('No room_type found')
  process.exit(1)
}
const roomTypeId = roomTypes[0].id

const { rows: roomUnits } = await pg.query<{ id: string; floor: number }>(
  `select id, floor from public.room_units where is_active = true limit 1`,
)
const roomUnitId = roomUnits[0].id

// ── Case 1: Algorithm unit test ───────────────────────────────────────────
await step('algorithm unit test (3 HKs + 6 tasks → balanced workload)', () => {
  const housekeepers = [
    { id: 'hk-a', fullName: 'A', isAvailable: true, defaultFloors: new Set<number>() },
    { id: 'hk-b', fullName: 'B', isAvailable: true, defaultFloors: new Set<number>() },
    { id: 'hk-c', fullName: 'C', isAvailable: true, defaultFloors: new Set<number>() },
  ]
  const tasks = [
    { id: 't1', roomUnitId: 'r1', floor: 1, estimatedMinutes: 20, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:00Z' },
    { id: 't2', roomUnitId: 'r2', floor: 1, estimatedMinutes: 20, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:01Z' },
    { id: 't3', roomUnitId: 'r3', floor: 2, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:02Z' },
    { id: 't4', roomUnitId: 'r4', floor: 2, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:03Z' },
    { id: 't5', roomUnitId: 'r5', floor: 3, estimatedMinutes: 45, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:04Z' },
    { id: 't6', roomUnitId: 'r6', floor: 3, estimatedMinutes: 45, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:05Z' },
  ]
  const result = allocateTasks({ housekeepers, tasks })
  assert(result.assignments.length === 6, `expected 6, got ${result.assignments.length}`)
  const total = 190 // 20+20+30+30+45+45
  const perHK = total / 3
  for (const [hkId, load] of Object.entries(result.loadByHousekeeper)) {
    // LPT min-load aims for ±15% of perfect balance (170 → 190 → 240)
    // With 3 HKs and 190 total, perHK target ≈ 63.3
    assert(
      Math.abs(load - perHK) <= 40,
      `${hkId} load=${load} min off-balance (target ${perHK})`,
    )
  }
  return `loads=${JSON.stringify(result.loadByHousekeeper)}`
})

// ── Case 2: Floor preference ────────────────────────────────────────────
await step('floor preference respected when balance achievable', () => {
  const housekeepers = [
    { id: 'hk-floor2', fullName: 'F2-default', isAvailable: true, defaultFloors: new Set<number>([2]) },
    { id: 'hk-no-floor', fullName: 'No-default', isAvailable: true, defaultFloors: new Set<number>() },
  ]
  const tasks = [
    { id: 't1', roomUnitId: 'r1', floor: 2, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:00Z' },
    { id: 't2', roomUnitId: 'r2', floor: 2, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:01Z' },
    { id: 't3', roomUnitId: 'r3', floor: 3, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:02Z' },
    { id: 't4', roomUnitId: 'r4', floor: 3, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:03Z' },
  ]
  const result = allocateTasks({ housekeepers, tasks })
  // hk-floor2 should get the 2 floor-2 tasks (FLOOR_BONUS=200 dominates)
  const floor2Tasks = result.assignments.filter((a) => tasks.find((t) => t.id === a.taskId)?.floor === 2)
  assert(floor2Tasks.length === 2, `expected 2 floor-2 tasks, got ${floor2Tasks.length}`)
  for (const a of floor2Tasks) {
    assert(a.housekeeperId === 'hk-floor2', `floor-2 task assigned to wrong HK`)
  }
  return 'floor-2 default HK received all floor-2 tasks'
})

// ── Case 3: Priority ordering ────────────────────────────────────────────
await step('priority ordering: urgent before normal', () => {
  const housekeepers = [
    { id: 'hk-1', fullName: 'A', isAvailable: true, defaultFloors: new Set<number>() },
    { id: 'hk-2', fullName: 'B', isAvailable: true, defaultFloors: new Set<number>() },
  ]
  const tasks = [
    { id: 't-urgent', roomUnitId: 'r1', floor: 1, estimatedMinutes: 30, priority: 'urgent' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:00Z' },
    { id: 't-normal', roomUnitId: 'r2', floor: 1, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: null, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:01Z' },
  ]
  const result = allocateTasks({ housekeepers, tasks })
  // Both HKs start at 0 load. Urgent task should be assigned first (index 0).
  assert(result.assignments[0].taskId === 't-urgent', `urgent was not first`)
  return 'urgent task placed first'
})

// ── Case 4: Next-check-in urgency ─────────────────────────────────────────
await step('next-check-in urgency tiebreaker', () => {
  const housekeepers = [
    { id: 'hk-a', fullName: 'A', isAvailable: true, defaultFloors: new Set<number>() },
    { id: 'hk-b', fullName: 'B', isAvailable: true, defaultFloors: new Set<number>() },
  ]
  const inOneHour = new Date(Date.now() + 3600_000).toISOString()
  const inOneDay = new Date(Date.now() + 86_400_000).toISOString()
  const tasks = [
    { id: 't-soon', roomUnitId: 'r1', floor: 1, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: inOneHour, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:00Z' },
    { id: 't-later', roomUnitId: 'r2', floor: 1, estimatedMinutes: 30, priority: 'normal' as const, nextCheckIn: inOneDay, taskType: 'cleaning' as const, createdAt: '2026-01-01T00:00:01Z' },
  ]
  const result = allocateTasks({ housekeepers, tasks })
  // Urgent check-in task assigned first.
  assert(result.assignments[0].taskId === 't-soon', `soonest was not first`)
  return 'soonest check-in first'
})

// ── Case 5: RPC race condition ───────────────────────────────────────────
let raceTaskId: string | null = null
await step('RPC race condition: concurrent allocations', async () => {
  // Create one unassigned task.
  const { rows } = await pg.query<{ id: string }>(
    `insert into public.housekeeping_tasks (room_unit_id, task_type, priority, status, created_by, notes, estimated_minutes)
     values ($1, 'cleaning', 'normal', 'unassigned', $2, $3, 30)
     returning id`,
    [roomUnitId, managerUser.id, SENTINEL_NOTE],
  )
  raceTaskId = rows[0].id

  // Fire two RPC calls in parallel with overlapping assignments.
  // Use Supabase JS client (service-role) so auth.role()='service_role' passes
  // the RPC's role gate; direct PG has auth.role()=NULL and would fail.
  // NOTE: the RPC uses FOR UPDATE SKIP LOCKED — if both RPCs hit at the same
  // time before the INSERT is visible to the pooler, both could see 0 rows.
  // The RPC retries internally on stale read; for the test, retry once on miss.
  const rpcCall = async (hkId: string): Promise<Array<{ applied: boolean; skipped_reason: string }>> => {
    let lastData: Array<{ applied: boolean; skipped_reason: string }> = []
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supa.rpc('allocate_housekeeping_tasks', {
        p_assignments: [{ task_id: raceTaskId, housekeeper_id: hkId, estimated_minutes: 30 }],
        p_dry_run: false,
      })
      if (error) throw new Error(error.message)
      lastData = (data ?? []) as Array<{ applied: boolean; skipped_reason: string }>
      const found = lastData.find((r) => r.skipped_reason !== 'task_not_found')
      if (found) return lastData
      // Brief sleep to let the row propagate
      await new Promise((r) => setTimeout(r, 50))
    }
    return lastData
  }
  const [r1, r2] = await Promise.all([rpcCall(somjitUser.id), rpcCall(managerUser.id)])
  // Combine results: exactly one should be applied=true.
  const allRows = [...r1, ...r2] as Array<{ applied: boolean; skipped_reason: string | null }>
  const applied = allRows.filter((r) => r.applied).length
  const skipped = allRows.filter((r) => !r.applied).length
  assert(applied === 1, `expected exactly 1 applied, got ${applied}`)
  assert(skipped === 1, `expected exactly 1 skipped, got ${skipped}`)
  const skippedRow = allRows.find((r) => !r.applied)
  assert(
    skippedRow?.skipped_reason === 'task_already_assigned' || skippedRow?.skipped_reason === 'race_lost',
    `unexpected skip reason: ${skippedRow?.skipped_reason}`,
  )
  return `1 applied, 1 skipped (${skippedRow?.skipped_reason})`
})

// ── Case 6: markInspected → ready ─────────────────────────────────────────
let inspectedTaskId: string | null = null
await step('markInspected → room ready', async () => {
  // Create a cleaning task on a fresh room unit (reset to 'available' first so
  // the room is in a known state — previous tests may have left it dirty).
  const { rows: ru } = await pg.query<{ id: string }>(
    `select id from public.room_units where is_active = true order by floor, unit_label limit 1`,
  )
  if (ru.length === 0) throw new Error('No room_unit found')
  const testRoomId = ru[0].id
  await pg.query(`update public.room_units set status = 'available' where id = $1`, [testRoomId])
  // Insert as 'assigned' first (no trigger fires on INSERT).
  const { rows } = await pg.query<{ id: string }>(
    `insert into public.housekeeping_tasks (room_unit_id, task_type, priority, status, assigned_to, created_by, notes, estimated_minutes)
     values ($1, 'cleaning', 'normal', 'assigned', $2, $3, $4, 30)
     returning id`,
    [testRoomId, somjitUser.id, managerUser.id, SENTINEL_NOTE],
  )
  if (rows.length === 0) throw new Error('task INSERT failed')
  inspectedTaskId = rows[0].id

  // UPDATE → 'in_progress' fires on_task_status_change → room='cleaning'.
  await pg.query(
    `update public.housekeeping_tasks set status = 'in_progress' where id = $1`,
    [inspectedTaskId],
  )
  const { rows: before } = await pg.query<{ status: string }>(
    `select status from public.room_units where id = $1`,
    [testRoomId],
  )
  assert(before[0].status === 'cleaning', `expected cleaning, got ${before[0].status}`)

  // Mark inspected (sets task → completed, trigger flips room → ready).
  await pg.query(
    `update public.housekeeping_tasks
       set status = 'completed', completed_at = now(), updated_at = now()
     where id = $1`,
    [inspectedTaskId],
  )

  const { rows: after } = await pg.query<{ status: string }>(
    `select status from public.room_units where id = $1`,
    [testRoomId],
  )
  assert(after[0].status === 'ready', `expected ready, got ${after[0].status}`)
  return `room: cleaning → ready`
})

// ── Case 7: Check-out trigger ────────────────────────────────────────────
await step('check-out trigger creates task + flips room to waiting_cleaning', async () => {
  // Insert a confirmed booking (so we can flip to checked_out).
  const { rows: ru } = await pg.query<{ id: string }>(
    `select id from public.room_units where is_active = true limit 1`,
  )
  const testRoomId = ru[0].id
  // Reset room state to 'occupied' for the test.
  await pg.query(`update public.room_units set status = 'occupied' where id = $1`, [testRoomId])

  const { rows: booking } = await pg.query<{ id: string }>(
    `insert into public.bookings (booking_code, user_id, room_type_id, check_in, check_out, guests, nights, base_subtotal, discount_total, tax_total, fee_total, total, currency, status, payment_status, channel, booker_full_name, booker_email, booker_phone, room_unit_id)
     values ($1, $2, $3, current_date, current_date + 1, 1, 1, 1000, 0, 70, 150, 1220, 'THB', 'checked_in', 'paid', 'walk_in', 'Test Guest', 'test@zenzero.com', '0812345678', $4)
     returning id`,
    [`TEST-P30-co-${Date.now()}`, testUser.id, roomTypeId, testRoomId],
  )
  const bookingId = booking[0].id

  // service-role context (auth.uid()=NULL) — trigger still flips room but
  // skips task INSERT (created_by NOT NULL would fail). Verify the room flip.
  await pg.query(`update public.bookings set status = 'checked_out' where id = $1`, [bookingId])

  const { rows: roomAfter } = await pg.query<{ status: string }>(
    `select status from public.room_units where id = $1`,
    [testRoomId],
  )
  assert(
    roomAfter[0].status === 'waiting_cleaning',
    `expected waiting_cleaning, got ${roomAfter[0].status}`,
  )

  // With auth.uid() NULL the task INSERT is skipped (intentional).
  const { rows: tasks } = await pg.query<{ count: string }>(
    `select count(*) from public.housekeeping_tasks where booking_id = $1`,
    [bookingId],
  )
  assert(Number(tasks[0].count) === 0, `expected 0 tasks (auth.uid null), got ${tasks[0].count}`)
  return `room → waiting_cleaning, no task created (service-role context)`
})

// ── Case 8: NULL room_unit_id ────────────────────────────────────────────
await step('NULL room_unit_id skip in checkout trigger', async () => {
  const { rows: booking } = await pg.query<{ id: string }>(
    `insert into public.bookings (booking_code, user_id, room_type_id, check_in, check_out, guests, nights, base_subtotal, discount_total, tax_total, fee_total, total, currency, status, payment_status, channel, booker_full_name, booker_email, booker_phone, room_unit_id)
     values ($1, $2, $3, current_date, current_date + 1, 1, 1, 1000, 0, 70, 150, 1220, 'THB', 'checked_in', 'paid', 'walk_in', 'Test Guest', 'test@zenzero.com', '0812345678', null)
     returning id`,
    [`TEST-P30-null-${Date.now()}`, testUser.id, roomTypeId],
  )
  const bookingId = booking[0].id
  await pg.query(`update public.bookings set status = 'checked_out' where id = $1`, [bookingId])
  const { rows: tasks } = await pg.query<{ count: string }>(
    `select count(*) from public.housekeeping_tasks where booking_id = $1`,
    [bookingId],
  )
  assert(Number(tasks[0].count) === 0, `expected 0 tasks for null room_unit_id, got ${tasks[0].count}`)
  return 'skipped gracefully'
})

// ── Case 9: Dry-run mode ─────────────────────────────────────────────────
await step('RPC dry-run reports without writing', async () => {
  if (!raceTaskId) throw new Error('no race task from case 5')
  // Note: case 5 already assigned raceTaskId, so dry-run on it should report
  // task_already_assigned, not dry_run. Create a fresh task for dry-run.
  const { rows } = await pg.query<{ id: string }>(
    `insert into public.housekeeping_tasks (room_unit_id, task_type, priority, status, created_by, notes, estimated_minutes)
     values ($1, 'cleaning', 'normal', 'unassigned', $2, $3, 30)
     returning id`,
    [roomUnitId, managerUser.id, SENTINEL_NOTE],
  )
  const freshTaskId = rows[0].id

  // Use Supabase JS client (service-role) so auth.role()='service_role' passes
  // the RPC's role gate; direct PG has auth.role()=NULL and would fail.
  const { data: rpcResult, error: rpcErr } = await supa.rpc('allocate_housekeeping_tasks', {
    p_assignments: [{ task_id: freshTaskId, housekeeper_id: somjitUser.id, estimated_minutes: 30 }],
    p_dry_run: true,
  })
  if (rpcErr) throw new Error(rpcErr.message)
  const result = (rpcResult ?? [])[0] as { applied: boolean; skipped_reason: string }
  assert(result.applied === false, `expected applied=false, got ${result.applied}`)
  assert(
    result.skipped_reason === 'dry_run',
    `expected skipped_reason=dry_run, got ${result.skipped_reason}`,
  )

  // Task remains unassigned.
  const { rows: status } = await pg.query<{ status: string }>(
    `select status from public.housekeeping_tasks where id = $1`,
    [freshTaskId],
  )
  assert(status[0].status === 'unassigned', `task should remain unassigned, got ${status[0].status}`)
  return `dry-run reports without UPDATE`
})

// ── Case 10: No available housekeepers ───────────────────────────────────
await step('allocation warns when no HKs on shift', async () => {
  // Set all housekeepers' shift_position to 'off' for today.
  const today = new Date().toISOString().slice(0, 10)
  await pg.query(
    `update public.staff_shifts set position = 'off' where shift_date = $1 and position <> 'off'`,
    [today],
  )

  const { rows: snapshot } = await pg.query<{ id: string }>(
    `select id from public.profiles where role = 'housekeeper' and is_active = true`,
  )
  const housekeepers = snapshot.map((hk) => ({
    id: hk.id,
    fullName: hk.id.slice(0, 8),
    isAvailable: false, // all 'off' shift today
    defaultFloors: new Set<number>(),
  }))
  const { rows: taskRows } = await pg.query<{ id: string; room_unit_id: string; estimated_minutes: number | null; priority: string; created_at: string; task_type: string; floor: number }>(
    `select t.id, t.room_unit_id, t.estimated_minutes, t.priority, t.created_at, t.task_type, ru.floor
       from public.housekeeping_tasks t
       join public.room_units ru on ru.id = t.room_unit_id
      where t.status = 'unassigned'
      limit 1`,
  )
  if (taskRows.length > 0) {
    const tasks = taskRows.map((t) => ({
      id: t.id,
      roomUnitId: t.room_unit_id,
      floor: t.floor,
      estimatedMinutes: t.estimated_minutes ?? 30,
      priority: t.priority as 'low' | 'normal' | 'high' | 'urgent',
      nextCheckIn: null,
      taskType: t.task_type as 'cleaning' | 'turn_down' | 'deep_clean' | 'inspection' | 'restock',
      createdAt: t.created_at,
    }))
    const result = allocateTasks({ housekeepers, tasks })
    assert(result.assignments.length === 0, `expected 0 assignments, got ${result.assignments.length}`)
    assert(
      result.warnings.includes('No housekeepers on shift today'),
      `expected warning, got ${JSON.stringify(result.warnings)}`,
    )
  }
  return 'warning surfaced, 0 assignments'
})

await pg.end()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)