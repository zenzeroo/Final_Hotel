import { createClient } from '@/lib/supabase/server'
import { wrapSupabaseError } from '@/lib/errors/supabase'
import { getTodayBangkok, toBangkokIsoDate } from '@/lib/dates'
import type {
  HousekeepingTask, MaintenanceReport, RoomUnitBasic,
  DashboardStats, WorkHistoryData, MaintenanceStatus, MaintenanceSeverity,
} from './types'

export async function getMyTasksForUser(userId: string): Promise<HousekeepingTask[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select(`
      *,
      room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key)),
      assigned_user:profiles!housekeeping_tasks_assigned_to_fkey(full_name),
      created_user:profiles!housekeeping_tasks_created_by_fkey(full_name)
    `)
    .eq('assigned_to', userId)
    .in('status', ['assigned', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) wrapSupabaseError('', error)
  return (data ?? []) as HousekeepingTask[]
}

export async function getUnassignedTasks(): Promise<HousekeepingTask[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select(`
      *,
      room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key))
    `)
    .eq('status', 'unassigned')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) wrapSupabaseError('', error)
  return (data ?? []) as HousekeepingTask[]
}

export async function getMaintenanceReports(filters?: {
  status?: MaintenanceStatus[]; severity?: MaintenanceSeverity[]
}): Promise<MaintenanceReport[]> {
  const supabase = await createClient()
  let query = supabase
    .from('maintenance_reports')
    .select(`
      *,
      room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key)),
      reporter:profiles!maintenance_reports_reported_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
  if (filters?.status?.length) query = query.in('status', filters.status)
  if (filters?.severity?.length) query = query.in('severity', filters.severity)
  const { data, error } = await query
  if (error) wrapSupabaseError('', error)
  return (data ?? []) as MaintenanceReport[]
}

export async function getMyDashboardStatsForUser(userId: string): Promise<DashboardStats> {
  const supabase = await createClient()
  const [
    cleaningCount, myCount, maintCount, myTasks, priorityTasks,
    // Phase 30.2 — exact count of priority tasks for the tab badge.
    // The display array is capped at 5 (see `priorityTasks` below); this
    // count is the true total so the badge can show "5+" when overflow.
    priorityCount,
  ] = await Promise.all([
    supabase.from('room_units').select('id', { count: 'exact', head: true }).eq('status', 'cleaning'),
    supabase.from('housekeeping_tasks').select('id', { count: 'exact', head: true })
      .eq('assigned_to', userId).in('status', ['assigned', 'in_progress']),
    supabase.from('maintenance_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('housekeeping_tasks').select(`
      *, room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key))
    `).eq('assigned_to', userId).in('status', ['assigned', 'in_progress']),
    supabase.from('housekeeping_tasks').select(`
      *, room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key))
    `).in('priority', ['urgent', 'high']).in('status', ['unassigned', 'assigned', 'in_progress'])
      .order('priority', { ascending: false }).limit(5),
    supabase.from('housekeeping_tasks').select('id', { count: 'exact', head: true })
      .in('priority', ['urgent', 'high']).in('status', ['unassigned', 'assigned', 'in_progress']),
  ])
  if (cleaningCount.error) wrapSupabaseError('', cleaningCount.error)
  if (maintCount.error) wrapSupabaseError('', maintCount.error)
  if (priorityCount.error) wrapSupabaseError('', priorityCount.error)

  const today = new Date().toISOString().slice(0, 10)
  const completedTodayRes = await supabase.from('housekeeping_tasks').select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId).eq('status', 'completed').gte('completed_at', `${today}T00:00:00Z`)
  if (completedTodayRes.error) wrapSupabaseError('', completedTodayRes.error)
  const shiftProgress = Math.round(((completedTodayRes.count ?? 0) / 12) * 100)

  return {
    roomsToClean: cleaningCount.count ?? 0,
    shiftProgress,
    myTasksCount: myCount.count ?? 0,
    maintenanceOpenCount: maintCount.count ?? 0,
    priorityTasksCount: priorityCount.count ?? 0,
    priorityTasks: (priorityTasks.data ?? []) as HousekeepingTask[],
    activeTasks: (myTasks.data ?? []) as HousekeepingTask[],
  }
}

export async function getAllRoomUnits(): Promise<RoomUnitBasic[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('room_units')
    .select(`
      id, floor, unit_label, view_label, status,
      room_type:room_types(id, name, name_th, hero_image_key)
    `)
    .eq('is_active', true)
    .order('floor').order('unit_label')
  if (error) wrapSupabaseError('', error)
  return ((data ?? []) as unknown as RoomUnitBasic[])
}

export async function getMyWorkHistoryForUser(
  userId: string,
  options?: { monthFrom?: string; monthToExclusive?: string },
): Promise<WorkHistoryData> {
  return computeHistory(userId, options)
}

async function computeHistory(
  userId: string | null,
  options?: { monthFrom?: string; monthToExclusive?: string },
): Promise<WorkHistoryData> {
  const supabase = await createClient()

  // Phase 53b — month-scoped query: optional range filter (inclusive
  // lower, exclusive upper) drives `roomsCleaned` (exact count, not
  // capped by the row limit) + `recentLog`.
  let monthQuery = supabase.from('housekeeping_tasks').select(`
    id, task_type, priority, status, started_at, completed_at, room_unit_id,
    room_unit:room_units(id, floor, unit_label, view_label, status,
      room_type:room_types(id, name, name_th, hero_image_key))
  `, { count: 'exact' }).eq('status', 'completed').order('completed_at', { ascending: false }).limit(20)
  if (userId) monthQuery = monthQuery.eq('assigned_to', userId)
  if (options?.monthFrom) monthQuery = monthQuery.gte('completed_at', options.monthFrom)
  if (options?.monthToExclusive) monthQuery = monthQuery.lt('completed_at', options.monthToExclusive)

  // `tasksToday` + `tasksThisWeek` ignore the month filter — they always
  // reflect the sliding last 7 days, so the user sees "this month"
  // alongside "today" even when browsing a past month.
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  let recentQuery = supabase.from('housekeeping_tasks')
    .select('completed_at')
    .eq('status', 'completed')
    .gte('completed_at', weekAgo)
  if (userId) recentQuery = recentQuery.eq('assigned_to', userId)

  const [monthRes, recentRes] = await Promise.all([monthQuery, recentQuery])
  if (monthRes.error) wrapSupabaseError('', monthRes.error)
  if (recentRes.error) wrapSupabaseError('', recentRes.error)
  const completed = (monthRes.data ?? []) as unknown as HousekeepingTask[]
  const recent = (recentRes.data ?? []) as { completed_at: string | null }[]

  // Phase 53 — compare Bangkok calendar dates (CLAUDE.md pitfall #1);
  // `completed_at` is UTC, so slicing its ISO string is off-by-one at
  // 00:00-06:59 Bangkok time.
  const today = getTodayBangkok()
  const tasksToday = recent.filter(t => t.completed_at && toBangkokIsoDate(t.completed_at) === today).length

  return {
    roomsCleaned: monthRes.count ?? completed.length,
    tasksToday,
    tasksThisWeek: recent.length,
    recentLog: completed,
  }
}