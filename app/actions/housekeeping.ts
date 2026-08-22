'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/supabase/getSession'
import type { MaintenanceIssueType, MaintenanceSeverity } from '@/lib/data/types'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_ISSUE_TYPES: readonly MaintenanceIssueType[] = ['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'other']
const VALID_SEVERITIES: readonly MaintenanceSeverity[] = ['low', 'medium', 'high', 'critical']
const TITLE_MAX = 100
const DESCRIPTION_MAX = 1000

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

async function requireStaff() {
  const session = await getSession()
  if (!session) redirect('/login?next=/housekeeper')
  if (!['housekeeper', 'reception', 'manager', 'admin'].includes(session.role)) {
    redirect('/')
  }
  return session
}

export async function claimTask(taskId: string): Promise<ActionResult> {
  const session = await requireStaff()
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
  const session = await requireStaff()
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

  if (error) return { ok: false, error: error.message }

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/tasks')
  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}

export async function completeTask(taskId: string): Promise<ActionResult> {
  const session = await requireStaff()
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

  if (error) return { ok: false, error: error.message }

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
  const session = await requireStaff()
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

  if (error) return { ok: false, error: error.message }

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/maintenance')
  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}

export async function updateRoomStatus(
  unitId: string,
  newStatus: 'cleaning' | 'available'
): Promise<ActionResult> {
  await requireStaff()
  if (!isUuid(unitId)) return { ok: false, error: 'Invalid unit id' }
  const supabase = await createClient()

  if (!['cleaning', 'available'].includes(newStatus)) {
    return { ok: false, error: 'Invalid status. Only cleaning ↔ available allowed' }
  }

  const { error } = await supabase
    .from('room_units')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', unitId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}