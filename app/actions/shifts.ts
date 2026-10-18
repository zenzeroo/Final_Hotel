'use server'

/**
 * Phase 54 — staff shift scheduling (manager/admin).
 *
 * `staff_shifts` had no write path in the app, so the table went stale and
 * every housekeeper read as "off shift" — which disabled auto-allocation on
 * /manager/housekeeping. RLS `"staff_shifts manager write"`
 * (20260832_staff_shifts_and_email.sql) already allows manager/admin writes.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { isUuid } from '@/lib/ids'
import { addDaysIso } from '@/lib/dates'
import type { ShiftPosition } from '@/lib/data/types'
import type { ActionResult } from './housekeeping'

const VALID_POSITIONS: readonly ShiftPosition[] = ['morning', 'afternoon', 'evening', 'off']
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const STAFF_ROLES = ['reception', 'housekeeper', 'manager', 'admin']

function revalidateShiftPages() {
  revalidatePath('/manager/staff')
  revalidatePath('/manager/housekeeping')
}

export async function setStaffShiftAction(
  staffId: string,
  date: string,
  position: ShiftPosition | null,
): Promise<ActionResult> {
  await requireRole(['manager', 'admin'], '/manager')
  if (!isUuid(staffId)) return { ok: false, error: 'Invalid staff id' }
  if (!ISO_DATE_RE.test(date)) return { ok: false, error: 'Invalid date' }
  if (position !== null && !VALID_POSITIONS.includes(position)) {
    return { ok: false, error: 'Invalid shift position' }
  }

  const supabase = await createClient()

  const { data: staff, error: staffErr } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', staffId)
    .maybeSingle()
  if (staffErr) return actionFail(staffErr, 'Could not load staff member')
  if (!staff || !staff.is_active || !STAFF_ROLES.includes(staff.role)) {
    return { ok: false, error: 'Selected user is not an active staff member' }
  }

  const { error } = position === null
    ? await supabase.from('staff_shifts').delete().eq('staff_id', staffId).eq('shift_date', date)
    : await supabase
        .from('staff_shifts')
        .upsert({ staff_id: staffId, shift_date: date, position }, { onConflict: 'staff_id,shift_date' })
  if (error) return actionFail(error, 'Could not save shift')

  revalidateShiftPages()
  return { ok: true }
}

/**
 * Copy the 7 days before `weekStart` onto `weekStart..+6`, filling only
 * empty cells (`ignoreDuplicates` — existing shifts are never overwritten).
 */
export async function copyPreviousWeekShiftsAction(
  weekStart: string,
  role: string | null = null,
): Promise<ActionResult<{ filled: number }>> {
  await requireRole(['manager', 'admin'], '/manager')
  if (!ISO_DATE_RE.test(weekStart)) return { ok: false, error: 'Invalid date' }
  if (role !== null && !STAFF_ROLES.includes(role)) return { ok: false, error: 'Invalid role' }

  const supabase = await createClient()

  const [{ data: prev, error: prevErr }, { data: activeStaff, error: staffErr }] = await Promise.all([
    supabase
      .from('staff_shifts')
      .select('staff_id, shift_date, position')
      .gte('shift_date', addDaysIso(weekStart, -7))
      .lte('shift_date', addDaysIso(weekStart, -1)),
    // `role` (when given) scopes the copy to the role tab shown on screen.
    supabase.from('profiles').select('id').eq('is_active', true).in('role', role ? [role] : STAFF_ROLES),
  ])
  if (prevErr) return actionFail(prevErr, 'Could not load previous shifts')
  if (staffErr) return actionFail(staffErr, 'Could not load staff')

  const activeIds = new Set((activeStaff ?? []).map((s) => s.id))
  const rows = (prev ?? [])
    .filter((r) => activeIds.has(r.staff_id))
    .map((r) => ({
      staff_id: r.staff_id,
      shift_date: addDaysIso(r.shift_date, 7),
      position: r.position,
    }))
  if (rows.length === 0) return { ok: true, data: { filled: 0 } }

  const { data: inserted, error } = await supabase
    .from('staff_shifts')
    .upsert(rows, { onConflict: 'staff_id,shift_date', ignoreDuplicates: true })
    .select('staff_id')
  if (error) return actionFail(error, 'Could not copy shifts')

  revalidateShiftPages()
  return { ok: true, data: { filled: inserted?.length ?? 0 } }
}
