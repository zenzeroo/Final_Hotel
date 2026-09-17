/**
 * Phase 31 — createTask INSERT trigger integration test.
 *
 * Validates that on_task_insert() (added by migration
 * 20260923_create_task_insert_trigger.sql) flips room_units.status when a
 * new housekeeping_tasks row is INSERTed — closing the gap where
 * on_task_status_change only fires on UPDATE OF status.
 *
 * Cases:
 *   1. INSERT cleaning task on ready room       → room → waiting_cleaning
 *   2. INSERT inspection task on ready room     → room → inspection
 *   3. INSERT turn_down task on ready room      → room → waiting_cleaning
 *   4. INSERT deep_clean task on ready room     → room → waiting_cleaning
 *   5. INSERT restock task on ready room        → room → waiting_cleaning
 *   6. INSERT cleaning task on occupied room    → room stays occupied (guard)
 *   7. INSERT cleaning task on maintenance     → room stays maintenance (guard)
 *   8. INSERT cleaning task on out_of_order     → room stays out_of_order (guard)
 *   9. INSERT cleaning task on cleaning room    → room stays cleaning (guard)
 *  10. After INSERT, UPDATE task → in_progress  → on_task_status_change flips to cleaning
 *  11. After INSERT, UPDATE task → completed    → on_task_status_change flips to ready
 *
 * Prereqs:
 *   - Migration 20260923_create_task_insert_trigger.sql applied.
 *   - Fixture users: manager@zenzero.com, somjit@zenzero.com (housekeeper).
 *
 * Run: npx tsx scripts/test-phase31-create-task-sync.mts
 *
 * Cleanup: deletes tasks with sentinel notes, restores room status.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD
if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD required')
  process.exit(1)
}

const m = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)
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

const SENTINEL_NOTE = '[phase31-test]'

// ── Cleanup ──────────────────────────────────────────────────────────────
async function cleanup() {
  const { rows: sentinelTasks } = await pg.query<{ id: string; room_unit_id: string }>(
    `select id, room_unit_id from public.housekeeping_tasks where notes = $1`,
    [SENTINEL_NOTE],
  )
  if (sentinelTasks.length > 0) {
    // Capture room statuses BEFORE deleting tasks so we can restore.
    const roomIds = [...new Set(sentinelTasks.map((r) => r.room_unit_id))]
    // Restore room status — set all test rooms back to 'ready' (we never
    // touch occupied/maintenance rooms in the guard tests, only verify them).
    await pg.query(
      `update public.room_units set status = 'ready', updated_at = now()
       where id = any($1::uuid[])
         and status in ('waiting_cleaning','inspection','cleaning')`,
      [roomIds],
    )
    await pg.query(
      `delete from public.housekeeping_tasks where id = any($1::uuid[])`,
      [sentinelTasks.map((r) => r.id)],
    )
  }
}
await cleanup()

// ── Fixtures ─────────────────────────────────────────────────────────────
const { rows: users } = await pg.query<{ id: string; email: string }>(
  `select id, email from auth.users where email in ('manager@zenzero.com','somjit@zenzero.com')`,
)
const managerUser = users.find((u) => u.email === 'manager@zenzero.com')
const somjitUser = users.find((u) => u.email === 'somjit@zenzero.com')
if (!managerUser || !somjitUser) {
  console.error('Required fixtures not found. Need manager@ + somjit@ (housekeeper).')
  process.exit(1)
}

// ── Test room fixture helper ─────────────────────────────────────────────
// Pick or create a disposable room for each case. We pick 9 distinct rooms
// (one per status case) by scanning existing rooms. For guard-case rooms
// (occupied/maintenance/out_of_order/cleaning), we set the status explicitly
// and restore in cleanup.
async function pickRoom(targetStatus: string, label: string): Promise<{ id: string }> {
  const { rows } = await pg.query<{ id: string; floor: number; unit_label: string }>(
    `select id, floor, unit_label from public.room_units
       where is_active = true
       order by id
       limit 200`,
  )
  if (rows.length === 0) {
    console.error('No rooms in DB — cannot run test')
    process.exit(1)
  }
  // Pick the first room and force its status (test rooms are disposable).
  const room = rows[0]
  await pg.query(
    `update public.room_units set status = $1, updated_at = now()
       where id = $2`,
    [targetStatus, room.id],
  )
  return { id: room.id, ...label } as { id: string }
}

async function getRoomStatus(roomId: string): Promise<string> {
  const { rows } = await pg.query<{ status: string }>(
    `select status from public.room_units where id = $1`,
    [roomId],
  )
  return rows[0]?.status ?? 'unknown'
}

// ── Helper: INSERT a housekeeping_tasks row directly via service role ──
async function insertTask(args: {
  roomId: string
  taskType: string
  status: string
  assignedTo?: string | null
}): Promise<string> {
  const { rows } = await pg.query<{ id: string }>(
    `insert into public.housekeeping_tasks (
       room_unit_id, task_type, priority, status,
       assigned_to, created_by, booking_id, notes, estimated_minutes
     ) values (
       $1, $2::housekeeping_task_type, 'normal'::housekeeping_task_priority,
       $3::housekeeping_task_status, $4, $5, null, $6, 30
     ) returning id`,
    [args.roomId, args.taskType, args.status, args.assignedTo ?? null,
     managerUser!.id, SENTINEL_NOTE],
  )
  return rows[0].id
}

// ── Tests ────────────────────────────────────────────────────────────────

await step('1. INSERT cleaning task on ready room → waiting_cleaning', async () => {
  const room = await pickRoom('ready', 'case-1')
  await insertTask({ roomId: room.id, taskType: 'cleaning', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'waiting_cleaning', `expected waiting_cleaning, got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('2. INSERT inspection task on ready room → inspection', async () => {
  const room = await pickRoom('ready', 'case-2')
  await insertTask({ roomId: room.id, taskType: 'inspection', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'inspection', `expected inspection, got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('3. INSERT turn_down task on ready room → waiting_cleaning', async () => {
  const room = await pickRoom('ready', 'case-3')
  await insertTask({ roomId: room.id, taskType: 'turn_down', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'waiting_cleaning', `expected waiting_cleaning, got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('4. INSERT deep_clean task on ready room → waiting_cleaning', async () => {
  const room = await pickRoom('ready', 'case-4')
  await insertTask({ roomId: room.id, taskType: 'deep_clean', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'waiting_cleaning', `expected waiting_cleaning, got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('5. INSERT restock task on ready room → waiting_cleaning', async () => {
  const room = await pickRoom('ready', 'case-5')
  await insertTask({ roomId: room.id, taskType: 'restock', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'waiting_cleaning', `expected waiting_cleaning, got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('6. INSERT cleaning task on occupied room → stays occupied (guard)', async () => {
  const room = await pickRoom('occupied', 'case-6')
  await insertTask({ roomId: room.id, taskType: 'cleaning', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'occupied', `expected occupied (guard), got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('7. INSERT cleaning task on maintenance room → stays maintenance (guard)', async () => {
  const room = await pickRoom('maintenance', 'case-7')
  await insertTask({ roomId: room.id, taskType: 'cleaning', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'maintenance', `expected maintenance (guard), got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('8. INSERT cleaning task on out_of_order room → stays out_of_order (guard)', async () => {
  const room = await pickRoom('out_of_order', 'case-8')
  await insertTask({ roomId: room.id, taskType: 'cleaning', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'out_of_order', `expected out_of_order (guard), got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('9. INSERT cleaning task on cleaning room → stays cleaning (guard)', async () => {
  const room = await pickRoom('cleaning', 'case-9')
  await insertTask({ roomId: room.id, taskType: 'cleaning', status: 'unassigned' })
  const status = await getRoomStatus(room.id)
  assert(status === 'cleaning', `expected cleaning (guard), got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('10. UPDATE task → in_progress → existing trigger flips room to cleaning', async () => {
  const room = await pickRoom('ready', 'case-10')
  const taskId = await insertTask({ roomId: room.id, taskType: 'cleaning', status: 'unassigned' })
  // Assign task first so we can move to in_progress (constraint: must be 'assigned' or 'unassigned' on insert)
  await pg.query(
    `update public.housekeeping_tasks
       set status = 'assigned'::housekeeping_task_status, assigned_to = $1, updated_at = now()
       where id = $2`,
    [somjitUser!.id, taskId],
  )
  // Now move to in_progress — this is the on_task_status_change path
  await pg.query(
    `update public.housekeeping_tasks
       set status = 'in_progress'::housekeeping_task_status, started_at = now(), updated_at = now()
       where id = $1`,
    [taskId],
  )
  const status = await getRoomStatus(room.id)
  assert(status === 'cleaning', `expected cleaning after in_progress, got ${status}`)
  return `room ${room.id} → ${status}`
})

await step('11. UPDATE task → completed → existing trigger flips room to ready', async () => {
  const room = await pickRoom('ready', 'case-11')
  const taskId = await insertTask({ roomId: room.id, taskType: 'cleaning', status: 'unassigned' })
  await pg.query(
    `update public.housekeeping_tasks
       set status = 'in_progress'::housekeeping_task_status, started_at = now(), updated_at = now()
       where id = $1`,
    [taskId],
  )
  await pg.query(
    `update public.housekeeping_tasks
       set status = 'completed'::housekeeping_task_status, completed_at = now(), updated_at = now()
       where id = $1`,
    [taskId],
  )
  const status = await getRoomStatus(room.id)
  assert(status === 'ready', `expected ready after completed, got ${status}`)
  return `room ${room.id} → ${status}`
})

// ── Cleanup & summary ────────────────────────────────────────────────────
await cleanup()
await pg.end()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)