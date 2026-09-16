'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require'
import { actionFail, wrapSupabaseError } from '@/lib/errors/supabase'
import { isUuid } from '@/lib/ids'
import type {
  HousekeepingTaskPriority,
  HousekeepingTaskType,
  MaintenanceIssueType,
  MaintenanceSeverity,
} from '@/lib/data/types'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const VALID_ISSUE_TYPES: readonly MaintenanceIssueType[] = ['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'other']
const VALID_SEVERITIES: readonly MaintenanceSeverity[] = ['low', 'medium', 'high', 'critical']
const VALID_TASK_TYPES: readonly HousekeepingTaskType[] = ['cleaning', 'turn_down', 'deep_clean', 'inspection', 'restock']
const VALID_PRIORITIES: readonly HousekeepingTaskPriority[] = ['low', 'normal', 'high', 'urgent']
const TITLE_MAX = 100
const DESCRIPTION_MAX = 1000
const TASK_NOTES_MAX = 500

export async function claimTask(taskId: string): Promise<ActionResult> {
  const session = await requireRole(['housekeeper', 'reception', 'manager', 'admin'], '/housekeeper')
  if (session.role !== 'housekeeper' && session.role !== 'admin') {
    return { ok: false, error: 'Only housekeeper can claim tasks' }
  }
  if (!isUuid(taskId)) return { ok: false, error: 'Invalid task id' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .update({ status: 'assigned', assigned_to: session.id, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'unassigned')
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Task already claimed or not found' }

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/tasks')
  return { ok: true }
}

export async function startTask(taskId: string): Promise<ActionResult> {
  const session = await requireRole(['housekeeper', 'reception', 'manager', 'admin'], '/housekeeper')
  if (!isUuid(taskId)) return { ok: false, error: 'Invalid task id' }
  const supabase = await createClient()

  const { data: task, error: fetchErr } = await supabase
    .from('housekeeping_tasks')
    .select('assigned_to, status')
    .eq('id', taskId)
    .single()

  if (fetchErr || !task) return { ok: false, error: 'Task not found' }
  // Only the assigned housekeeper (or admin) can start their own task.
  // Reception may reassign via separate flow but cannot start someone else's task.
  if (task.assigned_to !== session.id && session.role !== 'admin') {
    return { ok: false, error: 'Not authorized for this task' }
  }

  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({ status: 'in_progress', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'assigned')

  if (error) return actionFail(error, 'Could not start task')

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/tasks')
  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}

export async function completeTask(taskId: string): Promise<ActionResult> {
  const session = await requireRole(['housekeeper', 'reception', 'manager', 'admin'], '/housekeeper')
  if (!isUuid(taskId)) return { ok: false, error: 'Invalid task id' }
  const supabase = await createClient()

  const { data: task, error: fetchErr } = await supabase
    .from('housekeeping_tasks')
    .select('assigned_to, status')
    .eq('id', taskId)
    .single()

  if (fetchErr || !task) return { ok: false, error: 'Task not found' }
  // Only the assigned housekeeper (or admin) can complete their own task.
  if (task.assigned_to !== session.id && session.role !== 'admin') {
    return { ok: false, error: 'Not authorized for this task' }
  }
  if (task.status !== 'in_progress') {
    return { ok: false, error: 'Task must be in progress to complete' }
  }

  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'in_progress')

  if (error) return actionFail(error, 'Could not complete task')

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/tasks')
  revalidatePath('/housekeeper/rooms')
  revalidatePath('/housekeeper/history')
  return { ok: true }
}

export async function reportMaintenance(input: {
  room_unit_id: string
  issue_type: MaintenanceIssueType
  severity: MaintenanceSeverity
  title: string
  description?: string
}): Promise<ActionResult> {
  const session = await requireRole(['housekeeper', 'reception', 'manager', 'admin'], '/housekeeper')
  const supabase = await createClient()

  if (!isUuid(input.room_unit_id)) return { ok: false, error: 'Invalid room id' }
  if (!VALID_ISSUE_TYPES.includes(input.issue_type)) return { ok: false, error: 'Invalid issue type' }
  if (!VALID_SEVERITIES.includes(input.severity)) return { ok: false, error: 'Invalid severity' }
  if (!input.title?.trim()) return { ok: false, error: 'Title required' }
  if (input.title.length > TITLE_MAX) return { ok: false, error: `Title too long (max ${TITLE_MAX})` }
  if (input.description && input.description.length > DESCRIPTION_MAX) {
    return { ok: false, error: `Description too long (max ${DESCRIPTION_MAX})` }
  }

  // Verify room exists and is active before allowing report
  const { data: room, error: roomErr } = await supabase
    .from('room_units')
    .select('id')
    .eq('id', input.room_unit_id)
    .eq('is_active', true)
    .maybeSingle()

  if (roomErr) return { ok: false, error: roomErr.message }
  if (!room) return { ok: false, error: 'Room not found or inactive' }

  const { error } = await supabase.from('maintenance_reports').insert({
    room_unit_id: input.room_unit_id,
    issue_type: input.issue_type,
    severity: input.severity,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    reported_by: session.id,
  })

  if (error) return actionFail(error, 'Could not report maintenance')

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/maintenance')
  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}

export async function updateRoomStatus(
  unitId: string,
  newStatus: 'waiting_cleaning' | 'cleaning' | 'ready' | 'available'
): Promise<ActionResult> {
  await requireRole(['reception', 'manager', 'admin'], '/login')
  if (!isUuid(unitId)) return { ok: false, error: 'Invalid unit id' }
  const supabase = await createClient()

  if (!['waiting_cleaning', 'cleaning', 'ready', 'available'].includes(newStatus)) {
    return { ok: false, error: 'Invalid status. Only waiting_cleaning/cleaning/ready/available allowed' }
  }

  const { error } = await supabase
    .from('room_units')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', unitId)

  if (error) return actionFail(error, 'Could not update room status')

  revalidatePath('/housekeeper/rooms')
  revalidatePath('/manager/housekeeping')
  return { ok: true }
}

// ----------------------------------------------------------------------------
// Phase 28 — manager-side task assignment + manual create + floor persistence
// Role gate: reception/manager/admin (per user choice + RLS alignment).
// Housekeepers keep their own claim flow via claimTask above.
// ----------------------------------------------------------------------------

async function validateHousekeeper(
  supabase: Awaited<ReturnType<typeof createClient>>,
  housekeeperId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: hk, error } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', housekeeperId)
    .maybeSingle()
  if (error) return { ok: false, error: 'Could not load housekeeper' }
  if (!hk || hk.role !== 'housekeeper' || !hk.is_active) {
    return { ok: false, error: 'Selected user is not an active housekeeper' }
  }
  return { ok: true }
}

export async function assignTask(taskId: string, housekeeperId: string): Promise<ActionResult<{ taskId: string }>> {
  await requireRole(['reception', 'manager', 'admin'], '/manager')
  if (!isUuid(taskId)) return { ok: false, error: 'Invalid task id' }
  if (!isUuid(housekeeperId)) return { ok: false, error: 'Invalid housekeeper id' }

  const supabase = await createClient()

  const check = await validateHousekeeper(supabase, housekeeperId)
  if (!check.ok) return check

  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .update({
      assigned_to: housekeeperId,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .in('status', ['unassigned', 'assigned'])
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Task not found or no longer available' }

  revalidatePath('/manager/housekeeping')
  revalidatePath('/housekeeper/tasks')
  revalidatePath('/housekeeper')
  return { ok: true, data: { taskId: data.id } }
}

export async function createTask(input: {
  roomUnitId: string
  taskType: HousekeepingTaskType
  priority: HousekeepingTaskPriority
  assignedTo: string | null
  notes?: string
}): Promise<ActionResult<{ taskId: string }>> {
  const session = await requireRole(['reception', 'manager', 'admin'], '/manager')
  if (!isUuid(input.roomUnitId)) return { ok: false, error: 'Invalid room id' }
  if (!VALID_TASK_TYPES.includes(input.taskType)) return { ok: false, error: 'Invalid task type' }
  if (!VALID_PRIORITIES.includes(input.priority)) return { ok: false, error: 'Invalid priority' }
  if (input.notes && input.notes.length > TASK_NOTES_MAX) {
    return { ok: false, error: `Notes too long (max ${TASK_NOTES_MAX})` }
  }

  const supabase = await createClient()

  const { data: room, error: roomErr } = await supabase
    .from('room_units')
    .select('id')
    .eq('id', input.roomUnitId)
    .eq('is_active', true)
    .maybeSingle()
  if (roomErr) return actionFail(roomErr, 'Could not load room')
  if (!room) return { ok: false, error: 'Room not found or inactive' }

  if (input.assignedTo) {
    if (!isUuid(input.assignedTo)) return { ok: false, error: 'Invalid housekeeper id' }
    const check = await validateHousekeeper(supabase, input.assignedTo)
    if (!check.ok) return check
  }

  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .insert({
      room_unit_id: input.roomUnitId,
      task_type: input.taskType,
      priority: input.priority,
      status: input.assignedTo ? 'assigned' : 'unassigned',
      assigned_to: input.assignedTo,
      created_by: session.id,
      booking_id: null,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (error) return actionFail(error, 'Could not create task')

  revalidatePath('/manager/housekeeping')
  revalidatePath('/housekeeper/tasks')
  return { ok: true, data: { taskId: data?.id ?? null } }
}

export async function setFloorAssignment(
  floor: number,
  housekeeperId: string | null,
): Promise<ActionResult> {
  const session = await requireRole(['reception', 'manager', 'admin'], '/manager')
  if (!Number.isInteger(floor) || floor < 0 || floor > 99) {
    return { ok: false, error: 'Invalid floor number' }
  }
  if (housekeeperId !== null && !isUuid(housekeeperId)) {
    return { ok: false, error: 'Invalid housekeeper id' }
  }

  const supabase = await createClient()

  if (housekeeperId) {
    const check = await validateHousekeeper(supabase, housekeeperId)
    if (!check.ok) return check
  }

  const { error } = await supabase
    .from('floor_assignments')
    .upsert(
      {
        floor,
        housekeeper_id: housekeeperId,
        updated_by: session.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'floor' },
    )

  if (error) return actionFail(error, 'Could not save floor assignment')

  revalidatePath('/manager/housekeeping')
  return { ok: true }
}

// ----------------------------------------------------------------------------
// Phase 30 — automatic allocation + inspection server actions
// Manager/admin only. Algorithm runs server-side, RPC commits atomically.
// ----------------------------------------------------------------------------

/**
 * Read the live snapshot for the auto-allocator: pending tasks, housekeepers
 * on shift today, per-floor defaults, next-check-in per room unit.
 *
 * Exported for the integration test (`scripts/test-phase30-housekeeping-allocation.mts`).
 */
export async function buildAllocationSnapshot() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [
    { data: taskRows, error: e1 },
    { data: hkRows, error: e2 },
    { data: shifts, error: e3 },
    { data: floorRows, error: e4 },
    { data: checkinRows, error: e5 },
  ] = await Promise.all([
    supabase
      .from('housekeeping_tasks')
      .select(
        `id, room_unit_id, task_type, priority, created_at, estimated_minutes,
         room_unit:room_units!inner(id, floor, room_type:room_types(estimated_cleaning_minutes))`,
      )
      .eq('status', 'unassigned')
      // Phase 30.1 — cap to 200 rows. PostgREST default is 1000, but a
      // backlog of 500+ tasks would make the algorithm (O(T·H·log T)) slow
      // AND bloat the RPC payload. 200 covers hotel scale (100+ rooms × 2
      // day backlog). Manager can re-run after the first batch clears.
      .limit(200),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'housekeeper')
      .eq('is_active', true),
    supabase
      .from('staff_shifts')
      .select('staff_id, position')
      .eq('shift_date', today)
      .neq('position', 'off'),
    supabase.from('floor_assignments').select('floor, housekeeper_id'),
    supabase.from('v_next_checkin_per_room').select('room_unit_id, next_check_in'),
  ])
  for (const [label, e] of [
    ['tasks', e1],
    ['housekeepers', e2],
    ['shifts', e3],
    ['floors', e4],
    ['checkins', e5],
  ] as const) {
    if (e) wrapSupabaseError(label, e)
  }

  const onShiftIds = new Set<string>(
    (shifts ?? []).map((s: { staff_id: string }) => s.staff_id),
  )
  const floorsByHK = new Map<string, Set<number>>()
  for (const f of floorRows ?? []) {
    if (!f.housekeeper_id) continue
    const set = floorsByHK.get(f.housekeeper_id) ?? new Set<number>()
    set.add(f.floor)
    floorsByHK.set(f.housekeeper_id, set)
  }
  const housekeepers = (hkRows ?? []).map((h: { id: string; full_name: string | null }) => ({
    id: h.id,
    fullName: h.full_name ?? '—',
    isAvailable: onShiftIds.has(h.id),
    defaultFloors: floorsByHK.get(h.id) ?? new Set<number>(),
  }))
  const nextCheckInMap = new Map<string, string | null>(
    (checkinRows ?? []).map((r: { room_unit_id: string; next_check_in: string | null }) => [
      r.room_unit_id,
      r.next_check_in,
    ]),
  )
  const tasks = (taskRows ?? []).map((t: {
    id: string
    room_unit_id: string
    task_type: 'cleaning' | 'turn_down' | 'deep_clean' | 'inspection' | 'restock'
    priority: 'low' | 'normal' | 'high' | 'urgent'
    created_at: string
    estimated_minutes: number | null
    room_unit: unknown
  }) => {
    const ru = (Array.isArray(t.room_unit) ? t.room_unit[0] : t.room_unit) as
      | { floor: number; room_type: { estimated_cleaning_minutes: number } | { estimated_cleaning_minutes: number }[] }
      | undefined
    const rt = ru
      ? (Array.isArray(ru.room_type) ? ru.room_type[0] : ru.room_type)
      : null
    return {
      id: t.id,
      roomUnitId: t.room_unit_id,
      floor: ru?.floor ?? 0,
      estimatedMinutes: t.estimated_minutes ?? rt?.estimated_cleaning_minutes ?? 30,
      priority: t.priority,
      nextCheckIn: nextCheckInMap.get(t.room_unit_id) ?? null,
      taskType: t.task_type,
      createdAt: t.created_at,
    }
  })
  return { tasks, housekeepers, nextCheckInMap }
}

/**
 * Phase 30 — runs the LPT + Min-Load algorithm and commits the result via
 * the SECURITY DEFINER RPC. Manager/admin only.
 */
export async function runAutoAllocation(): Promise<
  ActionResult<{
    assignedCount: number
    skippedCount: number
    /** Quick win — U3: count of skipped rows grouped by `skipped_reason`. */
    skippedReasons: Record<string, number>
    warnings: string[]
    loadByHousekeeper: Record<string, number>
  }>
> {
  await requireRole(['manager', 'admin'], '/manager')

  const supabase = await createClient()
  const { tasks, housekeepers } = await buildAllocationSnapshot()

  // Run the pure-TS algorithm.
  const { allocateTasks } = await import('@/lib/algorithms/housekeeping-allocation')
  const result = allocateTasks({ housekeepers, tasks })

  if (result.assignments.length === 0) {
    revalidatePath('/manager/housekeeping')
    revalidatePath('/housekeeper/tasks')
    revalidatePath('/housekeeper')
    return {
      ok: true,
      data: {
        assignedCount: 0,
        skippedCount: 0,
        skippedReasons: {},
        warnings: result.warnings,
        loadByHousekeeper: result.loadByHousekeeper,
      },
    }
  }

  const payload = result.assignments.map((a) => ({
    task_id: a.taskId,
    housekeeper_id: a.housekeeperId,
    estimated_minutes: a.estimatedMinutes,
  }))

  // Quick win — B7: caller-side retry on `task_not_found`. The RPC uses
  // `SELECT … FOR UPDATE SKIP LOCKED` per row; if two RPCs race, one may
  // see the row locked (returns null) before the other commits. A 50-150ms
  // backoff retries the lost rows so the manager sees the actual final
  // state, not a partial failure. `task_already_assigned` / `race_lost`
  // are terminal — they mean another caller already won, so we don't
  // retry those.
  type RpcRow = { task_id: string; housekeeper_id: string; applied: boolean; skipped_reason: string | null }
  const RETRY_BACKOFFS_MS = [0, 75, 150]
  const rows: RpcRow[] = []
  let remainingPayload = payload
  for (const backoffMs of RETRY_BACKOFFS_MS) {
    if (backoffMs > 0) await new Promise((r) => setTimeout(r, backoffMs))
    if (remainingPayload.length === 0) break
    const { data, error } = await supabase.rpc('allocate_housekeeping_tasks', {
      p_assignments: remainingPayload,
      p_dry_run: false,
    })
    if (error) return actionFail(error, 'Allocation RPC failed')
    const batch = (data ?? []) as RpcRow[]
    rows.push(...batch)
    // Only retry rows that were skipped due to a transient lock state.
    const retryIds = new Set(
      batch
        .filter((r) => r.skipped_reason === 'task_not_found')
        .map((r) => r.task_id),
    )
    if (retryIds.size === 0) break
    remainingPayload = remainingPayload.filter((a) => retryIds.has(a.task_id))
  }

  const applied = rows.filter((r) => r.applied).length
  const skipped = rows.length - applied

  // Quick win — U3: breakdown of skip reasons so the manager sees *why*
  // tasks weren't assigned (`race_lost`, `task_already_<status>`, etc.)
  // instead of just "X skipped".
  const skippedReasons: Record<string, number> = {}
  for (const r of rows) {
    if (r.applied) continue
    const reason = r.skipped_reason ?? 'unknown'
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1
  }

  revalidatePath('/manager/housekeeping')
  revalidatePath('/housekeeper/tasks')
  revalidatePath('/housekeeper')
  return {
    ok: true,
    data: {
      assignedCount: applied,
      skippedCount: skipped,
      skippedReasons,
      warnings: result.warnings,
      loadByHousekeeper: result.loadByHousekeeper,
    },
  }
}

/**
 * Phase 30 — manager closes the inspection step. The task must be in
 * `assigned` or `in_progress` status. The `on_task_status_change` trigger
 * flips `room_units.status` to `ready` on completion.
 *
 * Phase 30.1 — B1: gate on `task_type === 'inspection'`. Without this,
 * a manager accidentally clicking "Mark inspected" on a `cleaning` task
 * would skip the cleaning step (room flips to `ready` without ever being
 * `cleaning`), risking an unclean room being marked ready for sale.
 */
export async function markInspected(taskId: string): Promise<ActionResult> {
  const session = await requireRole(['manager', 'admin'], '/manager')
  if (!isUuid(taskId)) return { ok: false, error: 'Invalid task id' }
  const supabase = await createClient()

  const { data: task, error: fetchErr } = await supabase
    .from('housekeeping_tasks')
    .select('status, room_unit_id, task_type, assigned_to')
    .eq('id', taskId)
    .single()
  if (fetchErr || !task) return { ok: false, error: 'Task not found' }
  // Phase 30.1 — gate on inspection-only (was missing; see B1 in
  // C:\Users\suns9\.claude\plans\role-manager-glimmering-mitten.md).
  if (task.task_type !== 'inspection') {
    return {
      ok: false,
      error: `markInspected requires task_type="inspection" (got "${task.task_type}")`,
    }
  }
  if (task.status !== 'in_progress' && task.status !== 'assigned') {
    return { ok: false, error: 'Task must be in progress (or assigned) to mark inspected' }
  }

  const updates: Record<string, unknown> = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  // Defensive: if the task was unassigned when marked inspected (manager is
  // acting on behalf of a housekeeper who already started), stamp created_by.
  if (task.assigned_to == null) updates.assigned_to = session.id

  const { error } = await supabase
    .from('housekeeping_tasks')
    .update(updates)
    .eq('id', taskId)
    .in('status', ['assigned', 'in_progress'])

  if (error) return actionFail(error, 'Could not mark inspected')

  revalidatePath('/manager/housekeeping')
  revalidatePath('/housekeeper/tasks')
  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}