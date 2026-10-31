/**
 * /manager/rooms close/reopen — live DB integration test.
 *
 * Exercises closeRoomForMaintenance + reopenRoomForCleaning
 * (lib/data/supabase-manager.ts) with a service client against one real
 * `available` room, then restores the room and deletes everything it made.
 *
 *   npx tsx scripts/test-rates-close-reopen.mts
 */
import { config as loadEnv } from 'dotenv'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { closeRoomForMaintenance, reopenRoomForCleaning } from '../lib/data/supabase-manager'

loadEnv({ path: '.env.local' })
const svc = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)
// The helpers are typed for the cookie client; at runtime any supabase-js client works.
const db = svc as unknown as Parameters<typeof reopenRoomForCleaning>[0]

let passed = 0
let failed = 0
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`)
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const startedAt = new Date().toISOString()

const { data: manager } = await svc.from('profiles').select('id').eq('role', 'manager').limit(1).single()
assert(manager, 'no manager profile')

// A sellable room (available/ready). Prefer one with no open task; when every
// room already has one, the test checks reopen adds none (it never touches
// pre-existing tasks).
const { data: candidates } = await svc
  .from('room_units')
  .select('id, unit_label, status')
  .eq('is_active', true)
  .in('status', ['available', 'ready'])
const { data: busy } = await svc
  .from('housekeeping_tasks')
  .select('room_unit_id')
  .in('status', ['unassigned', 'assigned', 'in_progress'])
const busyIds = new Set((busy ?? []).map((t) => t.room_unit_id))
const unit = (candidates ?? []).find((u) => !busyIds.has(u.id)) ?? candidates?.[0]
assert(unit, 'no available/ready room to test with')
const openTasks = async () =>
  (await svc
    .from('housekeeping_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('room_unit_id', unit.id)
    .in('status', ['unassigned', 'assigned', 'in_progress'])).count ?? 0
const tasksBefore = await openTasks()
const expectedTasks = Math.max(tasksBefore, 1)
console.log(`Using room ${unit.unit_label} (${unit.id})`)

const statusOf = async () =>
  (await svc.from('room_units').select('status').eq('id', unit.id).single()).data!.status as string

let reportId: string | null = null
try {
  await step('close → maintenance', async () => {
    await closeRoomForMaintenance(db, { unitId: unit.id })
    assert((await statusOf()) === 'maintenance', `status=${await statusOf()}`)
  })

  await step('closing again is a no-op (no error)', async () => {
    await closeRoomForMaintenance(db, { unitId: unit.id })
    assert((await statusOf()) === 'maintenance', `status=${await statusOf()}`)
  })

  await step('reopen → waiting_cleaning + a cleaning task + report resolved', async () => {
    const { data: rep, error } = await svc
      .from('maintenance_reports')
      .insert({
        room_unit_id: unit.id, issue_type: 'other', severity: 'low', status: 'in_progress',
        title: '[rates-test]', reported_by: manager.id,
      })
      .select('id')
      .single()
    assert(!error && rep, `report insert: ${error?.message}`)
    reportId = rep.id

    await reopenRoomForCleaning(db, { unitId: unit.id, actorId: manager.id })
    assert((await statusOf()) === 'waiting_cleaning', `status=${await statusOf()}`)

    const n = await openTasks()
    assert(n === expectedTasks, `open tasks=${n}, expected ${expectedTasks} (before=${tasksBefore})`)

    const r = (await svc.from('maintenance_reports').select('status').eq('id', rep.id).single()).data!
    assert(r.status === 'resolved', `report status=${r.status}`)
  })

  await step('reopen twice does not add a second task', async () => {
    await svc.from('room_units').update({ status: 'maintenance' }).eq('id', unit.id)
    await reopenRoomForCleaning(db, { unitId: unit.id, actorId: manager.id })
    const n = await openTasks()
    assert(n === expectedTasks, `open tasks=${n}, expected ${expectedTasks}`)
  })

  await step('closing an occupied room is refused', async () => {
    await svc.from('room_units').update({ status: 'occupied' }).eq('id', unit.id)
    let threw = ''
    try {
      await closeRoomForMaintenance(db, { unitId: unit.id })
    } catch (e) {
      threw = (e as Error).message
    }
    assert(/แขกพักอยู่/.test(threw), `expected refusal, got "${threw}"`)
    assert((await statusOf()) === 'occupied', `status=${await statusOf()}`)
  })
} finally {
  await svc
    .from('housekeeping_tasks')
    .delete()
    .eq('room_unit_id', unit.id)
    .eq('created_by', manager.id)
    .gte('created_at', startedAt)
  if (reportId) await svc.from('maintenance_reports').delete().eq('id', reportId)
  await svc.from('room_units').update({ status: unit.status }).eq('id', unit.id)
  console.log(`Cleanup: room ${unit.unit_label} restored to ${await statusOf()}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
