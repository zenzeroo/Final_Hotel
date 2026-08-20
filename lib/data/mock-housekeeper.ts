import type {
  HousekeepingTask, MaintenanceReport, RoomUnitBasic,
  DashboardStats, WorkHistoryData, MaintenanceStatus, MaintenanceSeverity,
} from './types'
import mockData from '@/data/mock-housekeeper.json'

const MOCK_ROOM_UNITS: RoomUnitBasic[] = [
  { id: 'u-001', floor: 1, unit_label: '101', view_label: 'Garden View', status: 'cleaning', room_type: { id: 'rt-001', name: 'Deluxe Garden', name_th: 'ดีลักซ์ การ์เดน', hero_image_key: 'rooms/deluxe-garden-1.jpg' }},
  { id: 'u-002', floor: 1, unit_label: '102', view_label: 'Pool View', status: 'cleaning', room_type: { id: 'rt-002', name: 'Deluxe Pool', name_th: 'ดีลักซ์ พูล', hero_image_key: 'rooms/deluxe-pool-1.jpg' }},
  { id: 'u-003', floor: 2, unit_label: '201', view_label: 'Garden View', status: 'cleaning', room_type: { id: 'rt-001', name: 'Deluxe Garden', name_th: 'ดีลักซ์ การ์เดน', hero_image_key: 'rooms/deluxe-garden-1.jpg' }},
  { id: 'u-004', floor: 2, unit_label: '202', view_label: 'Garden View', status: 'available', room_type: { id: 'rt-001', name: 'Deluxe Garden', name_th: 'ดีลักซ์ การ์เดน', hero_image_key: 'rooms/deluxe-garden-1.jpg' }},
  { id: 'u-005', floor: 2, unit_label: '203', view_label: 'Pool View', status: 'maintenance', room_type: { id: 'rt-003', name: 'Suite Pool', name_th: 'สวีท พูล', hero_image_key: 'rooms/suite-pool-1.jpg' }},
  { id: 'u-006', floor: 3, unit_label: '301', view_label: 'City View', status: 'available', room_type: { id: 'rt-004', name: 'Premier City', name_th: 'พรีเมียร์ ซิตี้', hero_image_key: 'rooms/premier-city-1.jpg' }},
  { id: 'u-007', floor: 3, unit_label: '302', view_label: 'City View', status: 'available', room_type: { id: 'rt-005', name: 'VIP Suite', name_th: 'วีไอพี สวีท', hero_image_key: 'rooms/vip-suite-1.jpg' }},
  { id: 'u-008', floor: 3, unit_label: '303', view_label: 'Pool View', status: 'available', room_type: { id: 'rt-003', name: 'Suite Pool', name_th: 'สวีท พูล', hero_image_key: 'rooms/suite-pool-1.jpg' }},
  { id: 'u-009', floor: 4, unit_label: '401', view_label: 'City View', status: 'available', room_type: { id: 'rt-004', name: 'Premier City', name_th: 'พรีเมียร์ ซิตี้', hero_image_key: 'rooms/premier-city-1.jpg' }},
  { id: 'u-010', floor: 4, unit_label: '402', view_label: 'City View', status: 'occupied', room_type: { id: 'rt-005', name: 'VIP Suite', name_th: 'วีไอพี สวีท', hero_image_key: 'rooms/vip-suite-1.jpg' }},
  { id: 'u-011', floor: 4, unit_label: '403', view_label: 'Garden View', status: 'available', room_type: { id: 'rt-001', name: 'Deluxe Garden', name_th: 'ดีลักซ์ การ์เดน', hero_image_key: 'rooms/deluxe-garden-1.jpg' }},
  { id: 'u-012', floor: 4, unit_label: '404', view_label: 'Pool View', status: 'occupied', room_type: { id: 'rt-003', name: 'Suite Pool', name_th: 'สวีท พูล', hero_image_key: 'rooms/suite-pool-1.jpg' }},
]

const MOCK_USERS: Record<string, { full_name: string }> = {
  'u-house-1': { full_name: 'Somjit (You)' },
  'u-house-2': { full_name: 'Niran' },
  'u-recep-1': { full_name: 'Malee' },
  'u-admin-1': { full_name: 'Admin' },
}

function enrichTask(t: HousekeepingTask): HousekeepingTask {
  return {
    ...t,
    room_unit: MOCK_ROOM_UNITS.find(u => u.id === t.room_unit_id),
    assigned_user: t.assigned_to ? MOCK_USERS[t.assigned_to] ?? null : null,
    created_user: MOCK_USERS[t.created_by] ?? null,
  }
}

function enrichReport(r: MaintenanceReport): MaintenanceReport {
  return {
    ...r,
    room_unit: MOCK_ROOM_UNITS.find(u => u.id === r.room_unit_id),
    reporter: MOCK_USERS[r.reported_by] ?? null,
  }
}

const CURRENT_USER_ID = 'u-house-1'

export async function getMyTasksForUser(_userId?: string): Promise<HousekeepingTask[]> {
  const tasks = (mockData.tasks as HousekeepingTask[]).filter(
    t => t.assigned_to === CURRENT_USER_ID && t.status !== 'completed' && t.status !== 'cancelled'
  )
  return tasks.map(enrichTask)
}

export async function getUnassignedTasks(): Promise<HousekeepingTask[]> {
  const tasks = (mockData.tasks as HousekeepingTask[]).filter(t => t.status === 'unassigned')
  return tasks.map(enrichTask)
}

export async function getMaintenanceReports(filters?: {
  status?: MaintenanceStatus[]; severity?: MaintenanceSeverity[]
}): Promise<MaintenanceReport[]> {
  let reports = mockData.maintenance_reports as MaintenanceReport[]
  if (filters?.status?.length) reports = reports.filter(r => filters.status!.includes(r.status))
  if (filters?.severity?.length) reports = reports.filter(r => filters.severity!.includes(r.severity))
  return reports.map(enrichReport).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getMyDashboardStatsForUser(_userId?: string): Promise<DashboardStats> {
  const allTasks = (mockData.tasks as HousekeepingTask[]).map(enrichTask)
  const roomsToClean = MOCK_ROOM_UNITS.filter(u => u.status === 'cleaning').length
  const myTasksCount = allTasks.filter(t => t.assigned_to === CURRENT_USER_ID && t.status !== 'completed').length
  const maintenanceOpenCount = (mockData.maintenance_reports as MaintenanceReport[]).filter(r => r.status === 'open').length
  const myCompletedToday = allTasks.filter(t =>
    t.assigned_to === CURRENT_USER_ID && t.status === 'completed' && t.completed_at?.startsWith('2026-08-20')
  ).length
  const shiftProgress = Math.round((myCompletedToday / 12) * 100)
  const priorityWeight: Record<string, number> = { urgent: 3, high: 2, normal: 1, low: 0 }
  const priorityTasks = allTasks
    .filter(t => t.priority === 'urgent' || t.priority === 'high')
    .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority])
    .slice(0, 5)
  const activeTasks = allTasks.filter(t => t.assigned_to === CURRENT_USER_ID && (t.status === 'assigned' || t.status === 'in_progress'))

  return { roomsToClean, shiftProgress, myTasksCount, maintenanceOpenCount, priorityTasks, activeTasks }
}

export async function getAllRoomUnits(): Promise<RoomUnitBasic[]> {
  return MOCK_ROOM_UNITS
}

export async function getMyWorkHistoryForUser(_userId?: string): Promise<WorkHistoryData> {
  return computeHistory(CURRENT_USER_ID)
}

export async function getAllWorkHistory(): Promise<WorkHistoryData> {
  return computeHistory(null)
}

function computeHistory(userId: string | null): WorkHistoryData {
  const completed = (mockData.tasks as HousekeepingTask[]).filter(
    t => t.status === 'completed' && (!userId || t.assigned_to === userId)
  )
  const roomsCleaned = completed.length
  const durations = completed
    .filter(t => t.started_at && t.completed_at)
    .map(t => (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000)
  const avgMinutes = durations.length ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length) : null
  const tasksToday = completed.filter(t => t.completed_at?.startsWith('2026-08-20')).length
  const tasksThisWeek = completed.filter(t => {
    if (!t.completed_at) return false
    return Date.now() - new Date(t.completed_at).getTime() < 7 * 86400000
  }).length

  const dailyPerformance: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    const count = completed.filter(t => t.completed_at?.startsWith(dateStr)).length
    dailyPerformance.push({ date: dateStr.slice(5), count })
  }

  const recentLog = completed
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    .slice(0, 20)
    .map(enrichTask)

  return { roomsCleaned, avgMinutes, tasksToday, tasksThisWeek, dailyPerformance, recentLog }
}