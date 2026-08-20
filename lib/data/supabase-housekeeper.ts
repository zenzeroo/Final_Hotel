import { createClient } from '@/lib/supabase/server'
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
  if (error) throw new Error(`Supabase: ${error.message}`)
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
  if (error) throw new Error(`Supabase: ${error.message}`)
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
  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data ?? []) as MaintenanceReport[]
}

export async function getMyDashboardStatsForUser(userId: string): Promise<DashboardStats> {
  const supabase = await createClient()
  const [cleaningCount, myCount, maintCount, myTasks, priorityTasks] = await Promise.all([
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
  ])
  if (cleaningCount.error) throw new Error(cleaningCount.error.message)
  if (maintCount.error) throw new Error(maintCount.error.message)

  const today = new Date().toISOString().slice(0, 10)
  const completedTodayRes = await supabase.from('housekeeping_tasks').select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId).eq('status', 'completed').gte('completed_at', `${today}T00:00:00Z`)
  if (completedTodayRes.error) throw new Error(completedTodayRes.error.message)
  const shiftProgress = Math.round(((completedTodayRes.count ?? 0) / 12) * 100)

  return {
    roomsToClean: cleaningCount.count ?? 0,
    shiftProgress,
    myTasksCount: myCount.count ?? 0,
    maintenanceOpenCount: maintCount.count ?? 0,
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
  if (error) throw new Error(`Supabase: ${error.message}`)
  return ((data ?? []) as unknown as RoomUnitBasic[])
}

export async function getMyWorkHistoryForUser(userId: string): Promise<WorkHistoryData> {
  return computeHistory(userId)
}

export async function getAllWorkHistory(): Promise<WorkHistoryData> {
  return computeHistory(null)
}

async function computeHistory(userId: string | null): Promise<WorkHistoryData> {
  const supabase = await createClient()
  let query = supabase.from('housekeeping_tasks').select(`
    id, task_type, priority, status, started_at, completed_at, room_unit_id,
    room_unit:room_units(id, floor, unit_label, view_label, status,
      room_type:room_types(id, name, name_th, hero_image_key))
  `).eq('status', 'completed').order('completed_at', { ascending: false }).limit(200)
  if (userId) query = query.eq('assigned_to', userId)
  const { data, error } = await query
  if (error) throw new Error(`Supabase: ${error.message}`)
  const completed = (data ?? []) as unknown as HousekeepingTask[]

  const roomsCleaned = completed.length
  const durations = completed
    .filter(t => t.started_at && t.completed_at)
    .map(t => (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000)
  const avgMinutes = durations.length ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length) : null
  const today = new Date().toISOString().slice(0, 10)
  const tasksToday = completed.filter(t => t.completed_at?.startsWith(today)).length
  const tasksThisWeek = completed.filter(t => {
    if (!t.completed_at) return false
    return Date.now() - new Date(t.completed_at).getTime() < 7 * 86400000
  }).length

  const dailyPerformance: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const count = completed.filter(t => t.completed_at?.startsWith(d)).length
    dailyPerformance.push({ date: d.slice(5), count })
  }

  return {
    roomsCleaned, avgMinutes, tasksToday, tasksThisWeek,
    dailyPerformance,
    recentLog: completed.slice(0, 20) as unknown as HousekeepingTask[],
  }
}