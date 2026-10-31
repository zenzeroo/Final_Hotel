'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { isUuid } from '@/lib/ids'
import { reopenRoomForCleaning } from '@/lib/data/manager'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

/**
 * Phase 31 — Manager confirms room closure for a maintenance report.
 *
 * Flips `maintenance_reports.status` from `open` to `in_progress` AND
 * `room_units.status` to `maintenance` for the affected room. Only
 * `manager` + `admin` can call this action (manager is the gate per
 * product spec — no more auto-flip on critical-severity INSERT).
 *
 * Idempotent: defensive `.eq('status', 'open')` on the UPDATE means a
 * second concurrent call sees `report.status !== 'open'` and returns
 * the early-out error before mutating.
 */
export async function confirmMaintenanceRoomClosure(
  reportId: string,
): Promise<ActionResult> {
  const session = await requireRole(['manager', 'admin'], '/manager')
  if (!isUuid(reportId)) return { ok: false, error: 'Invalid report id' }

  const supabase = await createClient()

  // Fetch + state guard
  const { data: report, error: fetchErr } = await supabase
    .from('maintenance_reports')
    .select('id, status, room_unit_id')
    .eq('id', reportId)
    .single()
  if (fetchErr || !report) return { ok: false, error: 'Report not found' }
  if (report.status !== 'open') {
    return { ok: false, error: `Cannot confirm: report is already ${report.status}` }
  }

  // Flip report to in_progress (defensive guard on status to prevent races)
  const { error: updateReportErr } = await supabase
    .from('maintenance_reports')
    .update({
      status: 'in_progress',
      assigned_to: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .eq('status', 'open')

  if (updateReportErr) return actionFail(updateReportErr, 'Could not confirm report')

  // Flip room to maintenance
  const { error: updateRoomErr } = await supabase
    .from('room_units')
    .update({ status: 'maintenance', updated_at: new Date().toISOString() })
    .eq('id', report.room_unit_id)

  if (updateRoomErr) return actionFail(updateRoomErr, 'Could not close room')

  revalidatePath('/manager/maintenance')
  revalidatePath('/reception/maintenance')
  revalidatePath('/housekeeper/maintenance')
  revalidatePath('/housekeeper/rooms')
  revalidatePath('/manager/housekeeping')
  revalidatePath('/manager/rooms')
  return { ok: true }
}

/**
 * Phase 31 — Manager marks a maintenance report resolved and reopens
 * the room.
 *
 * Only valid when report is `in_progress` (must confirm before resolving).
 * The room goes to `waiting_cleaning` with a cleaning task (via the shared
 * `reopenRoomForCleaning`), not straight to `available` — a room coming
 * out of repair needs cleaning before it is sold again.
 */
export async function resolveMaintenanceReport(
  reportId: string,
  resolutionNote?: string,
): Promise<ActionResult> {
  const session = await requireRole(['manager', 'admin'], '/manager')
  if (!isUuid(reportId)) return { ok: false, error: 'Invalid report id' }
  if (resolutionNote && resolutionNote.length > 500) {
    return { ok: false, error: 'Resolution note too long (max 500)' }
  }

  const supabase = await createClient()

  const { data: report, error: fetchErr } = await supabase
    .from('maintenance_reports')
    .select('id, status, room_unit_id')
    .eq('id', reportId)
    .single()
  if (fetchErr || !report) return { ok: false, error: 'Report not found' }
  if (report.status !== 'in_progress') {
    return {
      ok: false,
      error: `Cannot resolve: report must be in_progress (got ${report.status})`,
    }
  }

  const now = new Date().toISOString()
  const { error: updateReportErr } = await supabase
    .from('maintenance_reports')
    .update({
      status: 'resolved',
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', reportId)
    .eq('status', 'in_progress')

  if (updateReportErr) return actionFail(updateReportErr, 'Could not resolve report')

  // Same reopen path as /manager/rooms: room → waiting_cleaning + a cleaning task.
  try {
    await reopenRoomForCleaning(supabase, { unitId: report.room_unit_id, actorId: session.id })
  } catch (e) {
    return actionFail(e, 'Could not reopen room')
  }

  revalidatePath('/manager/maintenance')
  revalidatePath('/reception/maintenance')
  revalidatePath('/housekeeper/maintenance')
  revalidatePath('/housekeeper/rooms')
  revalidatePath('/manager/housekeeping')
  revalidatePath('/manager/rooms')
  return { ok: true }
}
