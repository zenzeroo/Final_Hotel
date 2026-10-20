/**
 * Supabase implementation of the Manager data layer.
 * Real PostgREST queries against the live DB; consumed by the manager
 * dashboard, bookings, housekeeping, reviews, and reports pages.
 */

import type {
  ManagerDashboardStats,
  HousekeepingOverviewData,
  FloorStatusGroup,
  FloorAssignment,
  UnassignedTask,
  RoomStatusCell,
  BookingsOversightData,
  BookingOversightRow,
  BookingOversightStatus,
  AuditLogEntry,
  ReportsData,
  RevenueBarPoint,
  DashboardAlert,
  DamageReport,
  DamageSeverity,
  RefundRequest,
  Promotion,
  StaffMember,
  ShiftSlot,
  ShiftWeek,
  ShiftPosition,
  HousekeeperDetail,
  HousekeeperDetailTask,
  HousekeepingTaskType,
  HousekeepingTaskPriority,
  HousekeepingTaskStatus,
  HotelSettings,
  RoomUnitWithType,
  SeasonalRate,
  CancellationPolicy,
  HeroSlide,
  HeroSlideSourceType,
  OccupancyPoint,
  ReportMetric,
  ReportTrendPoint,
  ReportRange,
  RankedRoom,
  RankedRoomTypeRevenue,
  ChannelSlice,
  HousekeeperOption,
  HousekeeperCard,
  AssignedTaskCard,
  HousekeeperWorkload,
} from './types'
import { wrapSupabaseError } from '@/lib/errors/supabase'
import { chartColors } from '@/lib/chart-theme'
import { addDaysIso, diffDaysIso, getTodayBangkok, parseReportRange, toBangkokIsoDate } from '@/lib/dates'

// =========================================================
// Phase 9C — Dashboard aggregations
// =========================================================

type BookingRow = {
  id: string
  booking_code: string
  booker_full_name: string
  check_in: string
  check_out: string
  nights: number
  total: number
  status: BookingOversightStatus | string
  created_at: string
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

// Stable palette — index by hash of the booking id so each row gets a
// consistent avatar background, similar to the mock data shape.
const AVATAR_PALETTE = [
  'bg-secondary-container',
  'bg-tertiary-container',
  'bg-primary-container',
  'bg-error-container',
]

function avatarBgClass(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!
}

const STATUS_NORMALIZE: Record<string, BookingOversightStatus> = {
  confirmed: 'paid',
  checked_in: 'paid',
  checked_out: 'paid',
  pending: 'pending',
  cancelled: 'cancelled',
  refunded: 'refunded',
}

function normalizeStatus(s: string): BookingOversightStatus {
  return STATUS_NORMALIZE[s] ?? 'pending'
}

export async function getManagerDashboardStats(): Promise<ManagerDashboardStats> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // Phase 54 — every day boundary is the Bangkok calendar day (was UTC, so
  // 00:00-06:59 local counted as "yesterday").
  const today = getTodayBangkok()
  const yesterday = addDaysIso(today, -1)
  const dayStart = (d: string) => `${d}T00:00:00+07:00`
  const todayStart = dayStart(today)
  const tomorrowStart = dayStart(addDaysIso(today, 1))
  const windowStart = dayStart(addDaysIso(today, -29)) // 30 daily buckets

  // Parallel queries — JS client multiplexes over a single HTTP/2 connection.
  const [
    { data: paidRows, error: e1 },
    { data: newTodayRows, error: e2 },
    { count: checkInsToday, error: e3 },
    { count: checkOutsToday, error: e4 },
    { count: inHouseBookings, error: e5 },
    { data: activeRooms, error: e6 },
    { data: criticalMaint, error: e7 },
    { data: urgentDamages, error: e8 },
    { data: pendingRefunds, error: e9 },
    { data: housekeepers, error: e10 },
    { data: shiftsToday, error: e11 },
    { data: openTaskRooms, error: e12 },
    { count: unassignedTasks, error: e13 },
    { count: pendingReviews, error: e14 },
  ] = await Promise.all([
    // Phase 54 — revenue = bookings actually paid (incl. partially refunded),
    // bucketed by Bangkok creation day. Previously summed every non-cancelled
    // booking, so expired / unpaid holds were reported as revenue.
    supabase
      .from('bookings')
      .select('total, created_at')
      .gte('created_at', windowStart)
      .lt('created_at', tomorrowStart)
      .in('payment_status', ['paid', 'partial_refund']),
    // New bookings today = live bookings only (no temp holds / expired / cancelled).
    supabase
      .from('bookings')
      .select('channel')
      .gte('created_at', todayStart)
      .lt('created_at', tomorrowStart)
      .in('status', ['confirmed', 'checked_in', 'checked_out']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('check_in', today)
      .in('status', ['confirmed', 'checked_in']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('check_out', today)
      .in('status', ['checked_in', 'checked_out']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .lte('check_in', today)
      .gt('check_out', today)
      .in('status', ['confirmed', 'checked_in']),
    // Active rooms (count for occupancy + dirty-room orphan detection).
    supabase.from('room_units').select('id, unit_label, status').eq('is_active', true),
    supabase
      .from('maintenance_reports')
      .select('id, room_unit:room_units!inner(unit_label)')
      .eq('severity', 'critical')
      .eq('status', 'open'),
    supabase
      .from('damage_reports')
      .select('id, room_unit:room_units!inner(unit_label)')
      .eq('resolved', false)
      .eq('severity', 'urgent'),
    supabase.from('refund_requests').select('amount').eq('status', 'pending'),
    supabase.from('profiles').select('id').eq('role', 'housekeeper').eq('is_active', true),
    supabase.from('staff_shifts').select('staff_id').eq('shift_date', today).neq('position', 'off'),
    supabase
      .from('housekeeping_tasks')
      .select('room_unit_id')
      .in('status', ['unassigned', 'assigned', 'in_progress'])
      .not('room_unit_id', 'is', null),
    supabase
      .from('housekeeping_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unassigned'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  for (const [label, e] of [
    ['paidRows', e1],
    ['newTodayRows', e2],
    ['checkInsToday', e3],
    ['checkOutsToday', e4],
    ['inHouseBookings', e5],
    ['activeRooms', e6],
    ['criticalMaintenance', e7],
    ['urgentDamages', e8],
    ['pendingRefunds', e9],
    ['housekeepers', e10],
    ['shiftsToday', e11],
    ['openTaskRooms', e12],
    ['unassignedTasks', e13],
    ['pendingReviews', e14],
  ] as const) {
    if (e) wrapSupabaseError(label, e)
  }

  // Revenue per Bangkok day across the 30-day window.
  const revenueByDay = new Map<string, number>()
  for (const r of paidRows ?? []) {
    const day = toBangkokIsoDate(r.created_at)
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(r.total ?? 0))
  }
  const revenueToday = revenueByDay.get(today) ?? 0
  const revenueYesterday = revenueByDay.get(yesterday) ?? 0
  const revenueTrendPct =
    revenueYesterday === 0 ? null : ((revenueToday - revenueYesterday) / revenueYesterday) * 100
  const buckets = (days: number): RevenueBarPoint[] =>
    Array.from({ length: days }, (_, i) => {
      const date = addDaysIso(today, i - (days - 1))
      return { date, revenue: revenueByDay.get(date) ?? 0 }
    })

  const newToday = newTodayRows ?? []
  const totalActiveRooms = (activeRooms ?? []).length
  const occupancyRatePct =
    totalActiveRooms > 0 ? Math.round(((inHouseBookings ?? 0) / totalActiveRooms) * 100) : 0

  // Phase 54 — one aggregated alert per kind (text localized at render).
  const roomLabel = (row: { room_unit: unknown }) => {
    const ru = (Array.isArray(row.room_unit) ? row.room_unit[0] : row.room_unit) as
      | { unit_label: string }
      | undefined
    return ru?.unit_label ?? '—'
  }
  const roomsWithOpenTask = new Set((openTaskRooms ?? []).map((t) => t.room_unit_id))
  const orphanRooms = (activeRooms ?? [])
    .filter((r) => (r.status === 'waiting_cleaning' || r.status === 'checkout') && !roomsWithOpenTask.has(r.id))
    .map((r) => r.unit_label)
  const onShift = new Set((shiftsToday ?? []).map((s) => s.staff_id))
  const hkOnShift = (housekeepers ?? []).filter((h) => onShift.has(h.id)).length

  const alerts: DashboardAlert[] = []
  const push = (a: Omit<DashboardAlert, 'id'>) => {
    if (a.count > 0) alerts.push({ id: a.kind, ...a })
  }
  push({
    kind: 'maintenanceCritical',
    severity: 'critical',
    count: (criticalMaint ?? []).length,
    rooms: (criticalMaint ?? []).map(roomLabel),
    href: '/manager/maintenance',
  })
  push({
    kind: 'damageUrgent',
    severity: 'critical',
    count: (urgentDamages ?? []).length,
    rooms: (urgentDamages ?? []).map(roomLabel),
    href: '/manager/housekeeping',
  })
  push({
    kind: 'refundsPending',
    severity: 'warning',
    count: (pendingRefunds ?? []).length,
    amount: (pendingRefunds ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0),
    href: '/manager/bookings?tab=refunds',
  })
  push({
    kind: 'noHousekeeperOnShift',
    severity: 'warning',
    count: (housekeepers ?? []).length > 0 && hkOnShift === 0 ? 1 : 0,
    href: '/manager/staff?tab=housekeeper#shifts',
  })
  push({
    kind: 'orphanDirtyRooms',
    severity: 'warning',
    count: orphanRooms.length,
    rooms: orphanRooms,
    href: '/manager/housekeeping',
  })
  push({ kind: 'unassignedTasks', severity: 'info', count: unassignedTasks ?? 0, href: '/manager/housekeeping' })
  push({ kind: 'reviewsPending', severity: 'info', count: pendingReviews ?? 0, href: '/manager/reviews' })

  return {
    revenueToday,
    revenueTrendPct,
    occupancyRatePct,
    checkInsToday: checkInsToday ?? 0,
    checkOutsToday: checkOutsToday ?? 0,
    newBookingsToday: newToday.length,
    // Phase 12: real channel split from bookings.channel column.
    webBookings: newToday.filter((b) => b.channel === 'web').length,
    walkInBookings: newToday.filter((b) => b.channel === 'walk_in').length,
    revenue7d: buckets(7),
    revenue30d: buckets(30),
    alerts,
  }
}

// Embedded select shape for damage_reports rows. Room unit + reporter profile
// are joined; resolver profile is NOT joined here because the UI does not
// render `resolvedBy` and saving the round-trip keeps the query cheaper.
type DamageReportRow = {
  id: string
  description: string
  photo_url: string | null
  severity: DamageSeverity
  cost_estimate: number | null
  resolved: boolean
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
  room_unit: { unit_label: string } | { unit_label: string }[] | null
  reporter: { full_name: string | null; email: string | null } | null
}

function unitLabel(roomUnit: DamageReportRow['room_unit']): string {
  if (!roomUnit) return ''
  return Array.isArray(roomUnit) ? roomUnit[0]?.unit_label ?? '' : roomUnit.unit_label
}

function reporterLabel(reporter: DamageReportRow['reporter']): string {
  if (!reporter) return ''
  return reporter.full_name ?? reporter.email ?? ''
}

function toDamageReport(row: DamageReportRow): DamageReport {
  return {
    id: row.id,
    roomNumber: unitLabel(row.room_unit),
    reportedBy: reporterLabel(row.reporter),
    description: row.description,
    photoUrl: row.photo_url,
    severity: row.severity,
    costEstimate: row.cost_estimate,
    resolved: row.resolved,
    resolvedBy: null,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
  }
}

const DAMAGE_REPORT_SELECT = `
  id, description, photo_url, severity, cost_estimate,
  resolved, resolved_at, resolution_note, created_at,
  room_unit:room_units!inner(unit_label),
  reporter:profiles!damage_reports_reported_by_fkey(full_name, email)
`

export async function getHousekeepingOverview(): Promise<HousekeepingOverviewData> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // Parallel queries: damage reports, active rooms, open unassigned tasks,
  // recent in-flight housekeeping tasks for floor assignment derivation,
  // Phase 28 additions: persisted floor_assignments, assigned/in-progress
  // tasks grouped by housekeeper, the housekeeper picker list.
  // Phase 30 additions: staff_shifts (workload %), v_next_checkin_per_room (ETA).
  // Phase 54: shift day is the Bangkok calendar day (was UTC — read
  // yesterday's shifts at 00:00-06:59 local). The former `activeTasks`
  // query duplicated `assignedByUser` (same filter) and was dropped.
  const today = getTodayBangkok()
  const [
    { data: damageRows, error: e1 },
    { data: rooms, error: e2 },
    { data: unassignedTasksRaw, error: e3 },
    { data: openTaskRooms, error: e4 },
    { data: persistedFloors, error: e5 },
    { data: assignedByUser, error: e6 },
    { data: housekeepers, error: e7 },
    { data: shifts, error: e8 },
    { data: nextCheckins, error: e9 },
    // Phase 30.1 — exact count for the Rebalance button label (the
    // unassignedTasks array is capped at .limit(20) so its .length is
    // not the true backlog size).
    { count: totalUnassignedRaw, error: e10 },
  ] = await Promise.all([
    supabase
      .from('damage_reports')
      .select(DAMAGE_REPORT_SELECT)
      .order('created_at', { ascending: false })
      // Quick win — P3: cap to 50 newest reports. Unbounded fetch on a
      // long-running hotel would balloon page load time. Full archive
      // lives in the DamageReportTable page (Phase 31 follow-up: pagination).
      .limit(50),
    supabase
      .from('room_units')
      .select('id, floor, unit_label, status')
      .eq('is_active', true)
      .order('floor', { ascending: true })
      .order('unit_label', { ascending: true }),
    supabase
      .from('housekeeping_tasks')
      .select('id, task_type, notes, created_at, priority, room_unit:room_units!inner(unit_label)')
      .eq('status', 'unassigned')
      .order('created_at', { ascending: true })
      .limit(20),
    // Phase 54: room ids with any open task — used to detect dirty rooms
    // that have no task at all (orphans the allocator can't see).
    supabase
      .from('housekeeping_tasks')
      .select('room_unit_id, status')
      .in('status', ['unassigned', 'assigned', 'in_progress'])
      .not('room_unit_id', 'is', null),
    supabase
      .from('floor_assignments')
      .select('floor, housekeeper_id, housekeeper:profiles!floor_assignments_housekeeper_id_fkey(full_name)'),
    supabase
      .from('housekeeping_tasks')
      .select(
        `
        id, task_type, priority, status, created_at, started_at, notes, assigned_to, estimated_minutes,
        room_unit_id,
        room_unit:room_units!inner(unit_label, floor),
        assignee:profiles!housekeeping_tasks_assigned_to_fkey(full_name)
      `,
      )
      .in('status', ['assigned', 'in_progress'])
      .not('assigned_to', 'is', null),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'housekeeper')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabase
      .from('staff_shifts')
      .select('staff_id, position')
      .eq('shift_date', today),
    supabase
      .from('v_next_checkin_per_room')
      .select('room_unit_id, next_check_in'),
    supabase
      .from('housekeeping_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unassigned'),
  ])
  for (const [label, e] of [
    ['damageReports', e1],
    ['rooms', e2],
    ['unassignedTasks', e3],
    ['openTaskRooms', e4],
    ['floorAssignments', e5],
    ['assignedByHousekeeper', e6],
    ['housekeepers', e7],
    ['shifts', e8],
    ['nextCheckins', e9],
    ['totalUnassignedCount', e10],
  ] as const) {
    if (e) wrapSupabaseError(label, e)
  }

  // Phase 30 — build lookup maps for shifts + next check-in.
  const onShiftToday = new Set<string>()
  for (const s of shifts ?? []) {
    if (s.position !== 'off') onShiftToday.add(s.staff_id)
  }
  const nextCheckInMap = new Map<string, string | null>()
  for (const r of nextCheckins ?? []) {
    nextCheckInMap.set(r.room_unit_id, r.next_check_in)
  }

  const damageReports = (damageRows ?? []).map((r) =>
    toDamageReport(r as unknown as DamageReportRow),
  )

  const totalRooms = (rooms ?? []).length
  // Map room_units.status → FloorRoomStatus for the floor grid.
  // Phase 31 user req: binary "dirty vs clean" view. Any state where an active
  // HK task exists (waiting_cleaning / cleaning / inspection) → 'dirty'
  // (yellow/red — needs HK attention). States where no task exists AND the
  // room is ready/occupied → 'inspected' (green — clean or out-of-flow).
  // maintenance/out_of_order/checkout → 'dirty' (yellow — exclude from
  // guest flow, not ready for sale). 'cleaning' FloorRoomStatus is now
  // unreachable (kept in the type union for future use). Phase 54: the
  // KPI cards no longer derive from this binary map — see ROOM_KPI_BUCKET.
  const ROOM_TO_FLOOR_STATUS: Record<string, 'dirty' | 'cleaning' | 'inspected'> = {
    available: 'inspected',
    occupied: 'inspected',
    cleaning: 'dirty',               // active HK task in progress (Phase 31 user req)
    inspection: 'dirty',             // active inspection task (Phase 31 user req)
    ready: 'inspected',              // post-inspection ready = clean
    waiting_cleaning: 'dirty',       // dirty queue, awaiting HK
    checkout: 'dirty',               // guest just left, pre-clean queue
    maintenance: 'dirty',
    out_of_order: 'dirty',
  }
  // Phase 54 — precise KPI buckets. The old binary counts lumped
  // maintenance rooms into "dirty" and occupied rooms into "ready", and the
  // "cleaning" card was always 0.
  const ROOM_KPI_BUCKET: Record<string, 'dirty' | 'outOfService' | 'ready' | 'occupied'> = {
    waiting_cleaning: 'dirty',
    checkout: 'dirty',
    cleaning: 'dirty',
    inspection: 'dirty',
    maintenance: 'outOfService',
    out_of_order: 'outOfService',
    available: 'ready',
    ready: 'ready',
    occupied: 'occupied',
  }
  const kpi = { dirty: 0, outOfService: 0, ready: 0, occupied: 0 }
  for (const r of rooms ?? []) {
    kpi[ROOM_KPI_BUCKET[r.status] ?? 'dirty']++
  }

  // Phase 54 — dirty rooms with no open task. Task cancellation flips the
  // room back to 'waiting_cleaning' without creating a replacement task, so
  // these accumulate silently and the auto-allocator never sees them.
  const roomsWithOpenTask = new Set((openTaskRooms ?? []).map((t) => t.room_unit_id))
  const orphanDirtyRooms = (rooms ?? [])
    .filter((r) => (r.status === 'waiting_cleaning' || r.status === 'checkout') && !roomsWithOpenTask.has(r.id))
    .map((r) => ({ id: r.id, unitLabel: r.unit_label }))

  // Build floors: group rooms by floor.
  const floorMap = new Map<number, RoomStatusCell[]>()
  for (const r of rooms ?? []) {
    const cell: RoomStatusCell = {
      roomNumber: r.unit_label,
      status: ROOM_TO_FLOOR_STATUS[r.status] ?? 'dirty',
      occupied: r.status === 'occupied',
    }
    const list = floorMap.get(r.floor) ?? []
    list.push(cell)
    floorMap.set(r.floor, list)
  }

  // Phase 28: persisted floor_assignments take priority over the
  // active-task-derived fallback. Map first; active-task loop only fills
  // floors that have no persisted row.
  const floorAssignee = new Map<number, { id: string; name: string }>()
  for (const f of persistedFloors ?? []) {
    const hk = Array.isArray(f.housekeeper) ? f.housekeeper[0] : f.housekeeper
    if (f.housekeeper_id && hk?.full_name) {
      floorAssignee.set(f.floor, { id: f.housekeeper_id, name: hk.full_name })
    }
  }
  // Fallback: derive from active tasks for floors without a persisted row.
  for (const t of assignedByUser ?? []) {
    const ru = Array.isArray(t.room_unit) ? t.room_unit[0] : t.room_unit
    if (!ru || floorAssignee.has(ru.floor)) continue
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    if (assignee?.full_name && t.assigned_to) {
      floorAssignee.set(ru.floor, { id: t.assigned_to, name: assignee.full_name })
    }
  }
  const floors: FloorStatusGroup[] = [...floorMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([floor, cells]) => {
      const a = floorAssignee.get(floor)
      return {
        floor,
        assignedTo: a?.name ?? null,
        rooms: cells,
      }
    })

  // Phase 54 — not-yet-started tasks per floor (what "assign whole floor" moves).
  const floorByRoomId = new Map((rooms ?? []).map((r) => [r.id, r.floor]))
  const pendingByFloor = new Map<number, number>()
  for (const t of openTaskRooms ?? []) {
    if (t.status === 'in_progress') continue
    const fl = floorByRoomId.get(t.room_unit_id)
    if (fl !== undefined) pendingByFloor.set(fl, (pendingByFloor.get(fl) ?? 0) + 1)
  }

  // Floor assignments: count rooms per floor + (persisted or derived) housekeeper.
  const floorAssignments: FloorAssignment[] = floors.map((f) => ({
    floor: f.floor,
    totalRooms: f.rooms.length,
    pendingTasks: pendingByFloor.get(f.floor) ?? 0,
    housekeeperId: floorAssignee.get(f.floor)?.id ?? null,
    housekeeperName: floorAssignee.get(f.floor)?.name ?? null,
  }))

  const unassignedTasks: UnassignedTask[] = (unassignedTasksRaw ?? []).map((t) => {
    const ru = Array.isArray(t.room_unit) ? t.room_unit[0] : t.room_unit
    return {
      id: t.id,
      taskType: t.task_type,
      roomNumber: ru?.unit_label ?? '—',
      requestedAt: t.created_at,
      urgent: t.priority === 'urgent' || t.priority === 'high',
    }
  })

  // Phase 28: housekeeper picker (manager dashboard needs this for assign UI).
  const housekeeperOptions: HousekeeperOption[] = (housekeepers ?? []).map((h) => ({
    id: h.id,
    fullName: h.full_name ?? '—',
  }))

  // Phase 28: tasks currently assigned or in-progress, grouped by housekeeper.
  // Cards on the manager dashboard show each housekeeper's workload.
  const cardsByUser = new Map<string, HousekeeperCard>()
  for (const t of assignedByUser ?? []) {
    if (!t.assigned_to) continue
    const ru = Array.isArray(t.room_unit) ? t.room_unit[0] : t.room_unit
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const card: AssignedTaskCard = {
      taskId: t.id,
      roomNumber: ru?.unit_label ?? '—',
      floor: ru?.floor ?? 0,
      taskType: t.task_type,
      priority: t.priority,
      status: t.status,
      createdAt: t.created_at,
      startedAt: t.started_at ?? null,
      notes: t.notes ?? null,
      assignedToId: t.assigned_to,
      // Phase 30 — ETA + urgency pill on the housekeeper card.
      estimatedMinutes: t.estimated_minutes ?? null,
      nextCheckIn: nextCheckInMap.get(t.room_unit_id) ?? null,
    }
    const existing = cardsByUser.get(t.assigned_to)
    if (existing) {
      existing.tasks.push(card)
    } else {
      cardsByUser.set(t.assigned_to, {
        housekeeperId: t.assigned_to,
        fullName: assignee?.full_name ?? '—',
        tasks: [card],
      })
    }
  }
  const assignedByHousekeeper: HousekeeperCard[] = [...cardsByUser.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  )

  // Phase 30 — populate per-card totalLoadMinutes + workloadPercent (8h = 480 min).
  const CAPACITY_MINUTES = 480
  for (const card of assignedByHousekeeper) {
    const totalLoadMinutes = card.tasks.reduce(
      (s, t) => s + (t.estimatedMinutes ?? 0),
      0,
    )
    card.totalLoadMinutes = totalLoadMinutes
    card.workloadPercent = onShiftToday.has(card.housekeeperId)
      ? Math.min(100, Math.round((totalLoadMinutes / CAPACITY_MINUTES) * 100))
      : 0
  }

  // Phase 30 — build housekeeperWorkloads for on-shift ids + floor defaults (includes HKs
  // with 0 tasks who don't appear in assignedByHousekeeper).
  const floorsByHK = new Map<string, number[]>()
  for (const f of persistedFloors ?? []) {
    if (!f.housekeeper_id) continue
    const arr = floorsByHK.get(f.housekeeper_id) ?? []
    arr.push(f.floor)
    floorsByHK.set(f.housekeeper_id, arr)
  }
  const loadByHKFromTasks = new Map<string, number>()
  const countByHKFromTasks = new Map<string, number>()
  for (const t of assignedByUser ?? []) {
    if (!t.assigned_to) continue
    loadByHKFromTasks.set(
      t.assigned_to,
      (loadByHKFromTasks.get(t.assigned_to) ?? 0) + (t.estimated_minutes ?? 0),
    )
    countByHKFromTasks.set(
      t.assigned_to,
      (countByHKFromTasks.get(t.assigned_to) ?? 0) + 1,
    )
  }
  const housekeeperWorkloads: HousekeeperWorkload[] = (housekeepers ?? [])
    .map((h) => {
      const isAvailable = onShiftToday.has(h.id)
      const currentLoadMinutes = loadByHKFromTasks.get(h.id) ?? 0
      const taskCount = countByHKFromTasks.get(h.id) ?? 0
      return {
        housekeeperId: h.id,
        fullName: h.full_name ?? '—',
        currentLoadMinutes,
        capacityMinutes: isAvailable ? CAPACITY_MINUTES : 0,
        taskCount,
        workloadPercent: isAvailable
          ? Math.min(100, Math.round((currentLoadMinutes / CAPACITY_MINUTES) * 100))
          : 0,
        isAvailable,
        floorDefaults: (floorsByHK.get(h.id) ?? []).sort((a, b) => a - b),
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  return {
    totalRooms,
    dirtyCount: kpi.dirty,
    outOfServiceCount: kpi.outOfService,
    readyCount: kpi.ready,
    occupiedCount: kpi.occupied,
    orphanDirtyRooms,
    floors,
    floorAssignments,
    unassignedTasks,
    totalUnassignedCount: totalUnassignedRaw ?? unassignedTasks.length,
    damageReports,
    housekeepers: housekeeperOptions,
    assignedByHousekeeper,
    housekeeperWorkloads,
  }
}

export async function listHousekeepers(): Promise<HousekeeperOption[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'housekeeper')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
  if (error) wrapSupabaseError('listHousekeepers', error)
  return (data ?? []).map((h) => ({ id: h.id, fullName: h.full_name ?? '—' }))
}

/**
 * Phase 30 — standalone workload summary per housekeeper (8h shift = 480 min).
 * Reuses the same query shape as `getHousekeepingOverview`. Useful for tests
 * and for callers that only need the workload table.
 */
export async function getHousekeeperWorkloads(): Promise<HousekeeperWorkload[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const today = getTodayBangkok()
  const [
    { data: hkRows, error: e1 },
    { data: shifts, error: e2 },
    { data: taskRows, error: e3 },
    { data: floorRows, error: e4 },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'housekeeper').eq('is_active', true).order('full_name'),
    supabase.from('staff_shifts').select('staff_id, position').eq('shift_date', today),
    supabase.from('housekeeping_tasks').select('assigned_to, estimated_minutes').in('status', ['assigned','in_progress']).not('assigned_to', 'is', null),
    supabase.from('floor_assignments').select('floor, housekeeper_id'),
  ])
  for (const [label, e] of [['hks', e1], ['shifts', e2], ['tasks', e3], ['floors', e4]] as const) {
    if (e) wrapSupabaseError(label, e)
  }
  const CAPACITY = 480
  const shiftRows = (shifts ?? []) as Array<{ staff_id: string; position: string }>
  const onShift = new Set(shiftRows.filter((s) => s.position !== 'off').map((s) => s.staff_id))
  const loadByHK = new Map<string, { load: number; count: number }>()
  for (const t of taskRows ?? []) {
    if (!t.assigned_to) continue
    const cur = loadByHK.get(t.assigned_to) ?? { load: 0, count: 0 }
    cur.load += t.estimated_minutes ?? 0
    cur.count += 1
    loadByHK.set(t.assigned_to, cur)
  }
  const floorsByHK = new Map<string, number[]>()
  for (const f of floorRows ?? []) {
    if (!f.housekeeper_id) continue
    const arr = floorsByHK.get(f.housekeeper_id) ?? []
    arr.push(f.floor)
    floorsByHK.set(f.housekeeper_id, arr)
  }
  const hkList = (hkRows ?? []) as Array<{ id: string; full_name: string | null }>
  return hkList.map((h) => {
    const stats = loadByHK.get(h.id) ?? { load: 0, count: 0 }
    const isAvailable = onShift.has(h.id)
    return {
      housekeeperId: h.id,
      fullName: h.full_name ?? '—',
      currentLoadMinutes: stats.load,
      capacityMinutes: isAvailable ? CAPACITY : 0,
      taskCount: stats.count,
      workloadPercent: isAvailable ? Math.min(100, Math.round((stats.load / CAPACITY) * 100)) : 0,
      isAvailable,
      floorDefaults: (floorsByHK.get(h.id) ?? []).sort((a, b) => a - b),
    }
  })
}

const DETAIL_TASK_SELECT = `
  id, task_type, priority, status, created_at, started_at, completed_at, notes,
  estimated_minutes, room_unit_id,
  room_unit:room_units!inner(unit_label, floor, room_type:room_types(name, name_th))
`

type DetailTaskRow = {
  id: string
  task_type: HousekeepingTaskType
  priority: HousekeepingTaskPriority
  status: HousekeepingTaskStatus
  created_at: string
  started_at: string | null
  completed_at: string | null
  notes: string | null
  estimated_minutes: number | null
  room_unit_id: string
  room_unit: unknown
}

const PRIORITY_RANK: Record<HousekeepingTaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

/**
 * Phase 54 — everything the manager's housekeeper detail page needs.
 * Returns `null` when `id` is not an active-or-inactive housekeeper (→ 404).
 */
export async function getHousekeeperDetail(id: string): Promise<HousekeeperDetail | null> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const today = getTodayBangkok()
  const dayStart = `${today}T00:00:00+07:00`
  const dayEnd = `${addDaysIso(today, 1)}T00:00:00+07:00`

  const [
    { data: profile, error: e1 },
    { data: shift, error: e2 },
    { data: floorRows, error: e3 },
    { data: openRows, error: e4 },
    { data: doneRows, error: e5 },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role').eq('id', id).maybeSingle(),
    supabase.from('staff_shifts').select('position').eq('staff_id', id).eq('shift_date', today).maybeSingle(),
    supabase.from('floor_assignments').select('floor').eq('housekeeper_id', id),
    supabase
      .from('housekeeping_tasks')
      .select(DETAIL_TASK_SELECT)
      .eq('assigned_to', id)
      .in('status', ['assigned', 'in_progress']),
    supabase
      .from('housekeeping_tasks')
      .select(DETAIL_TASK_SELECT)
      .eq('assigned_to', id)
      .eq('status', 'completed')
      .gte('completed_at', dayStart)
      .lt('completed_at', dayEnd)
      .order('completed_at', { ascending: false }),
  ])
  for (const [label, e] of [['profile', e1], ['shift', e2], ['floors', e3], ['openTasks', e4], ['completedToday', e5]] as const) {
    if (e) wrapSupabaseError(label, e)
  }
  if (!profile || profile.role !== 'housekeeper') return null

  const open = (openRows ?? []) as unknown as DetailTaskRow[]
  const nextCheckIns = await getNextCheckInForRooms([...new Set(open.map((t) => t.room_unit_id))])

  const toTask = (t: DetailTaskRow): HousekeeperDetailTask => {
    const ru = (Array.isArray(t.room_unit) ? t.room_unit[0] : t.room_unit) as
      | { unit_label: string; floor: number; room_type: unknown }
      | undefined
    const rt = (Array.isArray(ru?.room_type) ? ru?.room_type[0] : ru?.room_type) as
      | { name: string; name_th: string | null }
      | undefined
    return {
      id: t.id,
      roomNumber: ru?.unit_label ?? '—',
      floor: ru?.floor ?? 0,
      roomTypeName: rt?.name ?? '—',
      roomTypeNameTh: rt?.name_th ?? null,
      taskType: t.task_type,
      priority: t.priority,
      status: t.status,
      createdAt: t.created_at,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      estimatedMinutes: t.estimated_minutes,
      nextCheckIn: nextCheckIns.get(t.room_unit_id) ?? null,
      notes: t.notes,
    }
  }

  // In progress first, then priority, then soonest next check-in.
  const openTasks = open.map(toTask).sort((a, b) =>
    Number(b.status === 'in_progress') - Number(a.status === 'in_progress') ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.nextCheckIn ?? '9999').localeCompare(b.nextCheckIn ?? '9999'),
  )

  const position = (shift?.position ?? null) as ShiftPosition | null
  return {
    id: profile.id,
    fullName: profile.full_name ?? '—',
    shiftPosition: position,
    isOnShift: position !== null && position !== 'off',
    floors: (floorRows ?? []).map((f) => f.floor).sort((a, b) => a - b),
    loadMinutes: openTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0),
    openTasks,
    completedToday: ((doneRows ?? []) as unknown as DetailTaskRow[]).map(toTask),
  }
}

/**
 * Phase 30 — read `v_next_checkin_per_room` for the given room unit ids.
 * Returns a Map for O(1) lookup; missing ids map to `null`.
 */
export async function getNextCheckInForRooms(
  roomUnitIds: string[],
): Promise<Map<string, string | null>> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  if (roomUnitIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('v_next_checkin_per_room')
    .select('room_unit_id, next_check_in')
    .in('room_unit_id', roomUnitIds)
  if (error) wrapSupabaseError('getNextCheckInForRooms', error)
  const checkinRows = (data ?? []) as Array<{ room_unit_id: string; next_check_in: string | null }>
  return new Map(checkinRows.map((r) => [r.room_unit_id, r.next_check_in]))
}

export async function getBookingsOversight(): Promise<BookingsOversightData> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // Parallel queries: refunds (already wired 9B), active bookings, audit log,
  // and active count.
  const [
    { data: refundRows, error: e1 },
    { data: bookingRows, error: e2 },
    { data: auditRows, error: e3 },
    { count: activeCount, error: e4 },
  ] = await Promise.all([
    supabase
      .from('refund_requests')
      .select('id, booking_code, guest_name, reason, amount, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select(
        `
        id, booking_code, booker_full_name, check_in, check_out, nights, status,
        room_type:room_types(name),
        room_unit:room_units(unit_label)
      `,
      )
      // booking_status enum is ('pending','confirmed','checked_in','checked_out','cancelled');
      // 'refunded' lives on payment_status, not booking_status — including it
      // raises "invalid input value for enum booking_status".
      .in('status', ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'])
      .order('check_in', { ascending: false })
      .limit(50),
    supabase
      .from('booking_events')
      .select(
        `
        id, event_type, description, created_at, metadata,
        actor:profiles!booking_events_actor_id_fkey(full_name, role),
        booking:bookings(booking_code)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'checked_in', 'pending']),
  ])

  for (const [label, e] of [
    ['refunds', e1],
    ['bookings', e2],
    ['audit', e3],
    ['activeCount', e4],
  ] as const) {
    if (e) wrapSupabaseError(label, e)
  }

  const refundRequests: RefundRequest[] = (refundRows ?? []).map((r) => ({
    id: r.id,
    bookingCode: r.booking_code,
    guestName: r.guest_name,
    reason: r.reason,
    amount: r.amount,
  }))

  const bookings: BookingOversightRow[] = (bookingRows ?? []).map((row) => {
    // room_type + room_unit are embedded relations; could be null for
    // orphaned bookings. room_unit is null until reception checks the guest
    // in and selects a unit (see CheckInOutActions + migration 20260834).
    const roomType = Array.isArray(row.room_type) ? row.room_type[0] : row.room_type
    const roomUnit = Array.isArray(row.room_unit) ? row.room_unit[0] : row.room_unit
    const roomNumber = roomUnit?.unit_label ?? '—'
    return {
      id: row.id,
      code: row.booking_code,
      guestName: row.booker_full_name,
      guestInitials: initials(row.booker_full_name),
      avatarBgClass: avatarBgClass(row.id),
      roomNumber,
      roomType: roomType?.name ?? '—',
      checkIn: row.check_in,
      checkOut: row.check_out,
      nights: row.nights,
      status: normalizeStatus(row.status),
    }
  })

  const auditLog: AuditLogEntry[] = (auditRows ?? []).map((row) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor
    const booking = Array.isArray(row.booking) ? row.booking[0] : row.booking
    const fullName = actor?.full_name ?? null
    const role = (actor?.role ?? null) as AuditLogEntry['staffRole']
    // Back-compat decorated string (legacy font-mono callers). New code
    // should prefer staffName + staffRole separately. Previously this
    // returned "MGR-USER" / "MGR-SYSTEM" for non-manager/admin roles
    // because the old logic hard-coded a fallback that swallowed the
    // real actor name. Always show the real name when available.
    const staffId = fullName
      ? role
        ? `${fullName} (${role})`
        : fullName
      : 'System'
    const eventType = row.event_type
    const badgeMap: Record<string, string> = {
      special_edit: 'bg-secondary-container text-on-secondary-container',
      refund_approved: 'bg-error-container text-on-error-container',
      note_added: 'bg-tertiary-container text-on-tertiary-container',
      checked_in: 'bg-primary-container text-on-primary-container',
      checked_out: 'bg-secondary-container text-on-secondary-container',
      cancelled: 'bg-error-container text-on-error-container',
      created: 'bg-surface-variant text-on-surface-variant',
      confirmed: 'bg-primary-container text-on-primary-container',
      // Phase 17 — written by confirm_payment_session RPC + markCashPaidAction.
      payment_confirmed: 'bg-primary text-on-primary',
      // Phase 18 — written by confirm_refund_session RPC when Stripe POSTs
      // charge.refunded to the webhook. Confirms the guest's card was
      // actually credited, distinct from `refund_approved` (manager intent).
      refund_confirmed: 'bg-error text-on-error',
    }
    const actionLabel: Record<string, string> = {
      special_edit: 'Special Edit',
      refund_approved: 'Refund Approved',
      note_added: 'Note Added',
      checked_in: 'Check-in',
      checked_out: 'Check-out',
      cancelled: 'Cancelled',
      created: 'Created',
      confirmed: 'Confirmed',
      // Phase 17 — matches the new booking_events.event_type value written by
      // the webhook handler (online) and markCashPaidAction (walk-in cash).
      payment_confirmed: 'Payment Confirmed',
      // Phase 18 — webhook-driven refund confirmation (distinct from
      // manager-initiated `refund_approved`).
      refund_confirmed: 'Refund Confirmed (Stripe)',
    }
    return {
      id: row.id,
      // The mock renders absolute timestamps like "Today, 09:41 AM" — we use
      // a simple ISO date for the live layer. UI already accepts arbitrary
      // string here.
      timestamp: row.created_at,
      staffId,
      staffName: fullName,
      staffRole: role,
      action: actionLabel[eventType] ?? eventType,
      actionBadgeClass: badgeMap[eventType] ?? 'bg-surface-variant text-on-surface-variant',
      targetCode: booking?.booking_code ?? '—',
      details: row.description ?? '',
    }
  })

  return {
    activeCount: activeCount ?? 0,
    bookings,
    refundRequests,
    auditLog,
  }
}

export async function getReportsData(range: ReportRange = parseReportRange()): Promise<ReportsData> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // All windows are Bangkok calendar days (`from`/`to` inclusive). Timestamp
  // bounds use +07:00 so a booking made at 01:00 Bangkok lands on the right
  // day (UTC would put it on the previous one).
  const { from, to, days, granularity } = range
  const today = getTodayBangkok()
  const toExcl = addDaysIso(to, 1)
  // Previous window of the same length, for the trend badges.
  const prevFrom = addDaysIso(from, -days)
  const bkk = (date: string) => `${date}T00:00:00+07:00`

  // Real bookings — abandoned holds (temp_pending / expired / payment_expired)
  // never became bookings and must not skew rates, rankings or channels.
  // Only values that exist in the live `booking_status` enum — an unknown
  // value (e.g. 'no_show') makes Postgres reject the whole query (22P02).
  const REAL_STATUSES = ['confirmed', 'checked_in', 'checked_out', 'cancelled']
  const STAYING_STATUSES = ['confirmed', 'checked_in', 'checked_out']
  // Revenue = money actually received, keyed on the stay's check-in date.
  const PAID_STATUSES = ['paid', 'partial_refund']

  // Chart buckets: one per day, or one per calendar month clipped to the
  // range. `start` inclusive, `end` exclusive (YYYY-MM-DD).
  type Bucket = { key: string; start: string; end: string }
  const buckets: Bucket[] = []
  if (granularity === 'day') {
    for (let d = from; d <= to; d = addDaysIso(d, 1)) {
      buckets.push({ key: d, start: d, end: addDaysIso(d, 1) })
    }
  } else {
    let start = from
    while (start <= to) {
      const [y, m] = start.split('-').map(Number)
      const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
      const end = nextMonth < toExcl ? nextMonth : toExcl
      buckets.push({ key: start.slice(0, 7), start, end })
      start = end
    }
  }
  const bucketKey = (date: string) => (granularity === 'day' ? date : date.slice(0, 7))

  // Same window one year earlier, for the occupancy comparison bars.
  const lastYear = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(y - 1, m - 1, d)).toISOString().slice(0, 10)
  }

  const [
    { data: revenueRows, error: e1 },
    { count: realCount, error: e2 },
    { count: cancelledCount, error: e4 },
    { count: prevCancelledCount, error: e5 },
    { count: activeRooms, error: e6 },
    { data: occRows, error: e7 },
    { data: occRowsLastYear, error: e8 },
    { data: roomTypeRows, error: e9 },
    { data: channelRows, error: e10 },
    { data: cancelledRows, error: e11 },
  ] = await Promise.all([
    // Paid revenue by check-in over the range (bars + header) and the
    // previous window of equal length (trend). check_out → room-nights for ADR.
    supabase
      .from('bookings')
      .select('check_in, check_out, total')
      .gte('check_in', prevFrom)
      .lte('check_in', to)
      .in('status', STAYING_STATUSES)
      .in('payment_status', PAID_STATUSES),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', bkk(from))
      .lt('created_at', bkk(toExcl))
      .in('status', REAL_STATUSES),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', bkk(from))
      .lt('created_at', bkk(toExcl))
      .eq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', bkk(prevFrom))
      .lt('created_at', bkk(from))
      .eq('status', 'cancelled'),
    supabase.from('room_units').select('id', { count: 'exact', head: true }).eq('is_active', true),
    // Stays overlapping the range (check_out is exclusive).
    supabase
      .from('bookings')
      .select('check_in, check_out')
      .lt('check_in', toExcl)
      .gt('check_out', from)
      .in('status', STAYING_STATUSES),
    supabase
      .from('bookings')
      .select('check_in, check_out')
      .lt('check_in', lastYear(toExcl))
      .gt('check_out', lastYear(from))
      .in('status', STAYING_STATUSES),
    supabase
      .from('bookings')
      .select('check_in, room_type_id, total, room_type:room_types(name)')
      .gte('check_in', from)
      .lte('check_in', to)
      .in('status', STAYING_STATUSES),
    supabase
      .from('bookings')
      .select('channel')
      .gte('check_in', from)
      .lte('check_in', to)
      .in('status', STAYING_STATUSES),
    // Cancellations per bucket — same definition as the cancellation card.
    supabase
      .from('bookings')
      .select('created_at')
      .gte('created_at', bkk(from))
      .lt('created_at', bkk(toExcl))
      .eq('status', 'cancelled'),
  ])
  for (const [label, e] of [
    ['revenueRows', e1],
    ['realCount', e2],
    ['cancelledCount', e4],
    ['prevCancelledCount', e5],
    ['activeRooms', e6],
    ['occRows', e7],
    ['occRowsLastYear', e8],
    ['roomTypeRows', e9],
    ['channelRows', e10],
    ['cancelledRows', e11],
  ] as const) {
    if (e) wrapSupabaseError(label, e)
  }

  // ── Revenue: header total, trend and bars share one definition ──
  const revenueByBucket = new Map<string, number>(buckets.map((b) => [b.key, 0]))
  // Paid room-nights per bucket (by check-in) — the ADR denominator.
  const paidNightsByBucket = new Map<string, number>()
  let prevRevenue = 0
  for (const r of revenueRows ?? []) {
    if (r.check_in < from) prevRevenue += r.total ?? 0
    else {
      const k = bucketKey(r.check_in)
      revenueByBucket.set(k, (revenueByBucket.get(k) ?? 0) + (r.total ?? 0))
      paidNightsByBucket.set(k, (paidNightsByBucket.get(k) ?? 0) + diffDaysIso(r.check_in, r.check_out))
    }
  }
  const totalRevenue = [...revenueByBucket.values()].reduce((s, v) => s + v, 0)
  // Percent change vs the previous window; +100% when that window was 0.
  const totalRevenueTrendPct =
    prevRevenue === 0
      ? totalRevenue > 0
        ? 100
        : 0
      : Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)

  // Labels are read directly off the UTC-anchored `b.start` ISO string
  // (YYYY-MM-DD) so they never shift with the server timezone.
  const dayLabel = (startIso: string) => {
    const [, m, d] = startIso.split('-')
    return `${d}/${m}`
  }
  const monthLabel = (startIso: string) => {
    const [y, m] = startIso.split('-')
    return `${m}/${y.slice(2)}`
  }
  const bucketLabel = (b: Bucket) =>
    granularity === 'day'
      ? b.start === today
        ? 'วันนี้'
        : dayLabel(b.start)
      : monthLabel(b.start)
  const revenue: RevenueBarPoint[] = buckets.map((b) => ({
    date: b.start,
    revenue: revenueByBucket.get(b.key) ?? 0,
    label: bucketLabel(b),
  }))

  // ── Cancellation rate over real bookings only ──
  const totalBookings = realCount ?? 0
  const cancelled = cancelledCount ?? 0
  const prevCancelled = prevCancelledCount ?? 0
  const cancellationRatePct = totalBookings > 0 ? Math.round((cancelled / totalBookings) * 100) : 0
  const cancellationTrendPct =
    prevCancelled === 0
      ? cancelled > 0
        ? 100
        : 0
      : Math.round(((cancelled - prevCancelled) / prevCancelled) * 100)

  // ── Occupancy: booked room-nights ÷ (active rooms × days in bucket) ──
  const rooms = activeRooms ?? 0
  const DAY_MS = 86_400_000
  const nightsIn = (rows: { check_in: string; check_out: string }[] | null, startIso: string, endIso: string) => {
    const start = Date.parse(startIso)
    const end = Date.parse(endIso)
    let nights = 0
    for (const r of rows ?? []) {
      const lo = Math.max(start, Date.parse(r.check_in))
      const hi = Math.min(end, Date.parse(r.check_out))
      if (hi > lo) nights += Math.round((hi - lo) / DAY_MS)
    }
    return { nights, days: Math.round((end - start) / DAY_MS) }
  }
  const pct = (nights: number, bucketDays: number) =>
    rooms > 0 && bucketDays > 0 ? Math.min(100, Math.round((nights / (rooms * bucketDays)) * 1000) / 10) : 0
  const hasLastYear = (occRowsLastYear ?? []).length > 0
  const occupancy: OccupancyPoint[] =
    rooms === 0
      ? []
      : buckets.map((b) => {
          const cur = nightsIn(occRows, b.start, b.end)
          const prev = nightsIn(occRowsLastYear, lastYear(b.start), lastYear(b.end))
          return {
            period: b.key,
            current: pct(cur.nights, cur.days),
            last: hasLastYear ? pct(prev.nights, prev.days) : null,
          }
        })

  // ── mostBookedRooms + highestRevenueRoomTypes: group by room_type_id ──
  type RoomTypeAgg = { id: string | null; name: string; count: number; revenue: number }
  // Supabase typing for the embedded `room_type:room_types(name)` select is
  // `never` when the project types aren't regenerated. Cast through unknown
  // so we can pluck the name defensively (array for !inner, object otherwise).
  type RoomTypeJoin = { name?: string } | { name?: string }[] | null
  const roomAgg = new Map<string, RoomTypeAgg>()
  for (const r of roomTypeRows ?? []) {
    const id = r.room_type_id
    if (!id) continue
    const joined = r.room_type as unknown as RoomTypeJoin
    const name =
      (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? '—'
    const cur = roomAgg.get(id) ?? { id, name, count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += r.total ?? 0
    roomAgg.set(id, cur)
  }
  const sortedByCount = [...roomAgg.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  const sortedByRevenue = [...roomAgg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  const mostBookedRooms: RankedRoom[] = sortedByCount.map((r) => ({
    name: r.name,
    count: r.count,
  }))
  const highestRevenueRoomTypes: RankedRoomTypeRevenue[] = sortedByRevenue.map((r) => ({
    name: r.name,
    revenue: r.revenue,
  }))

  // ── channels: GROUP BY channel + percent of total ──
  const channelCounts: Record<string, number> = {}
  let channelTotal = 0
  for (const r of channelRows ?? []) {
    const ch = r.channel ?? 'web'
    channelCounts[ch] = (channelCounts[ch] ?? 0) + 1
    channelTotal += 1
  }
  // Brand palette per channel — single source of truth for chart colours.
  const channelPalette: Record<string, string> = {
    web: chartColors.primary,
    walk_in: chartColors.secondary,
    phone: chartColors.tertiary,
    ota: chartColors.success,
  }
  const channelLabels: Record<string, string> = {
    web: 'เว็บไซต์',
    walk_in: 'Walk-in',
    phone: 'โทรศัพท์',
    ota: 'OTA',
  }
  const channels: ChannelSlice[] = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      label: channelLabels[key] ?? key,
      percent: channelTotal > 0 ? Math.round((count / channelTotal) * 100) : 0,
      color: channelPalette[key] ?? chartColors.textMuted,
    }))

  // ── Main-chart series: every switchable metric per bucket ──
  const bookingsByBucket = new Map<string, number>()
  for (const r of roomTypeRows ?? []) {
    const k = bucketKey(r.check_in)
    bookingsByBucket.set(k, (bookingsByBucket.get(k) ?? 0) + 1)
  }
  const cancelsByBucket = new Map<string, number>()
  for (const r of cancelledRows ?? []) {
    const k = bucketKey(toBangkokIsoDate(r.created_at))
    cancelsByBucket.set(k, (cancelsByBucket.get(k) ?? 0) + 1)
  }
  const adrOf = (rev: number, nights: number) => (nights > 0 ? Math.round(rev / nights) : 0)
  const trend: ReportTrendPoint[] = buckets.map((b, i) => ({
    period: b.key,
    label: bucketLabel(b),
    revenue: revenueByBucket.get(b.key) ?? 0,
    bookings: bookingsByBucket.get(b.key) ?? 0,
    adr: adrOf(revenueByBucket.get(b.key) ?? 0, paidNightsByBucket.get(b.key) ?? 0),
    occupancy: occupancy[i]?.current ?? 0,
    occupancyLast: occupancy[i]?.last ?? null,
    cancellations: cancelsByBucket.get(b.key) ?? 0,
  }))
  const totalPaidNights = [...paidNightsByBucket.values()].reduce((s, v) => s + v, 0)
  const wholeRange = nightsIn(occRows, from, toExcl)
  const trendSummary: Record<ReportMetric, number> = {
    revenue: totalRevenue,
    bookings: (roomTypeRows ?? []).length,
    adr: adrOf(totalRevenue, totalPaidNights),
    occupancy: pct(wholeRange.nights, wholeRange.days),
    cancellations: cancelled,
  }

  return {
    range,
    trend,
    trendSummary,
    hasOccupancyLastYear: hasLastYear,
    totalRevenue,
    totalRevenueTrendPct,
    revenue,
    occupancy,
    mostBookedRooms,
    highestRevenueRoomTypes,
    channels,
    totalBookings,
    cancellationRatePct,
    cancellationTrendPct,
  }
}

export async function resolveDamageReport(args: {
  reportId: string
  costEstimate: number
  resolutionNote: string
  // Phase 9B: stores a profile UUID in damage_reports.resolved_by (FK).
  resolvedBy: string
}): Promise<DamageReport> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('damage_reports')
    .update({
      resolved: true,
      cost_estimate: args.costEstimate,
      resolution_note: args.resolutionNote,
      resolved_by: args.resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', args.reportId)
    .select(DAMAGE_REPORT_SELECT)
    .single()
  if (error) wrapSupabaseError('', error)
  return toDamageReport(data as unknown as DamageReportRow)
}

export async function approveRefund(args: { refundId: string }): Promise<{ id: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  // Phase 10: RPC atomically flips refund_requests.status='approved' AND
  // bookings.payment_status='refunded' on the linked booking. Also records
  // decided_by = auth.uid() server-side (see 20260833_approve_refund_rpc.sql).
  const { error } = await supabase.rpc('approve_refund', {
    p_refund_id: args.refundId,
  })
  if (error) wrapSupabaseError('', error)
  return { id: args.refundId }
}

export async function rejectRefund(args: { refundId: string; reason: string }): Promise<{ id: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('refund_requests')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      decision_note: args.reason,
    })
    .eq('id', args.refundId)
  if (error) wrapSupabaseError('', error)
  return { id: args.refundId }
}

// =========================================================
// Phase 6 stubs
// =========================================================

export async function getHotelSettings(): Promise<HotelSettings> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hotel_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) wrapSupabaseError('', error)
  // The seeded singleton row (from 20260828 migration) is the source of truth.
  // If missing, fall back to safe defaults so the UI doesn't crash mid-deploy.
  if (!data) {
    return {
      id: 1,
      name: 'Zenzero Hotel',
      name_th: null,
      address: '',
      phone: '',
      email: '',
      tax_rate: 0.07,
      resort_fee: 150,
      currency: 'THB',
      check_in_time: '15:00',
      check_out_time: '11:00',
      locale_default: 'th',
      hero_image_key: null,
      updated_at: new Date(0).toISOString(),
      updated_by: null,
    }
  }
  return data as HotelSettings
}

export async function listPromotions(): Promise<Promotion[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('valid_from', { ascending: false })
  if (error) wrapSupabaseError('', error)
  // DB has no `updated_at` column on promotions; Promotion.updatedAt stays undefined.
  return (data ?? []) as Promotion[]
}

export async function getPromotionById(id: string): Promise<Promotion | null> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) wrapSupabaseError('', error)
  return (data as Promotion | null) ?? null
}

export async function listStaff(): Promise<StaffMember[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  // Phase 9D: pull email from profiles (mirrored from auth.users via the
  // 20260832 migration trigger). Exclude the regular 'user' role so the
  // /admin/staff page only lists hotel staff.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, is_active, avatar_key, hired_at, created_at')
    .in('role', ['reception', 'housekeeper', 'manager', 'admin'])
    .order('role', { ascending: true })
    .order('full_name', { ascending: true })
  if (error) wrapSupabaseError('', error)
  return (data ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name ?? '',
    email: r.email ?? '',
    role: r.role as StaffMember['role'],
    is_active: r.is_active,
    avatar_key: r.avatar_key ?? null,
    // hired_at column may be null for legacy rows (backfill is best-effort).
    // Fall back to created_at (cast to YYYY-MM-DD) so the UI always renders
    // a sensible date.
    hired_at: r.hired_at ?? (r.created_at ? r.created_at.slice(0, 10) : '1970-01-01'),
    phone: r.phone ?? null,
  }))
}

/**
 * Phase 54 — 7-day shift window starting at `weekStart` (default: today in
 * Bangkok). `dates` is always the full 7 days so the schedule renders its
 * columns even before any shift has been entered.
 */
export async function listShifts(weekStart: string = getTodayBangkok()): Promise<ShiftWeek> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const dates = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i))
  const { data, error } = await supabase
    .from('staff_shifts')
    .select('staff_id, shift_date, position')
    .gte('shift_date', dates[0])
    .lte('shift_date', dates[6])
    .order('shift_date', { ascending: true })
  if (error) wrapSupabaseError('', error)
  return {
    weekStart,
    dates,
    slots: (data ?? []).map((r) => ({
      staffId: r.staff_id,
      date: r.shift_date,
      position: r.position as ShiftSlot['position'],
    })),
  }
}

export async function listRoomUnits(): Promise<RoomUnitWithType[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('room_units')
    .select(`
      id, floor, unit_label, view_label, status,
      room_type:room_types(id, slug, name, name_th, base_price, hero_image_key)
    `)
    .eq('is_active', true)
    .order('floor', { ascending: true })
    .order('unit_label', { ascending: true })
  if (error) wrapSupabaseError('', error)
  return (data ?? []) as unknown as RoomUnitWithType[]
}

export async function listSeasonalRates(): Promise<SeasonalRate[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('seasonal_rates')
    .select(`*, room_type:room_types(name)`)
    .order('start_date', { ascending: false })
  if (error) wrapSupabaseError('', error)
  return (data ?? []).map((row) => {
    const r = row as SeasonalRate & { room_type: { name: string } | null }
    return { ...r, room_type_name: r.room_type?.name }
  })
}

export async function listCancellationPolicies(): Promise<CancellationPolicy[]> {
  // Phase 12: real query against the seeded table. refund_pct was added in
  // migration 20260834 (default 100, with 100/50/0 backfill for the 3
  // existing seed rows). public-read RLS is set in
  // 20260819_bookings_rls.sql:61-64, so no auth check is needed.
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cancellation_policies')
    .select('id, name, free_cancel_hours, refund_pct, description')
    .order('free_cancel_hours', { ascending: false })
  if (error) wrapSupabaseError('', error)
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    free_cancel_hours: r.free_cancel_hours,
    // numeric → number; explicit cast in case the JS client returns a string.
    refund_pct: Number(r.refund_pct),
    description: r.description,
  }))
}

export async function setPromotionActive(args: { promotionId: string; isActive: boolean }): Promise<Promotion> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('promotions')
    .update({ is_active: args.isActive })
    .eq('id', args.promotionId)
    .select('*')
    .single()
  if (error) wrapSupabaseError('', error)
  return data as Promotion
}

// Phase 7 — Admin CRUD (real implementations)
export async function createPromotion(args: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<Promotion> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const insertRow = {
    code: args.code,
    name: args.name,
    description: args.description,
    discount_type: args.discount_type,
    discount_value: args.discount_value,
    min_nights: args.min_nights,
    max_discount_amount: args.max_discount_amount ?? null,
    applies_to_room_types: args.applies_to_room_types ?? null,
    valid_from: args.valid_from,
    valid_until: args.valid_until,
    is_active: args.is_active,
    // Phase 43 — optional hero image.
    image_key: args.image_key ?? null,
  }
  const { data, error } = await supabase
    .from('promotions')
    .insert(insertRow)
    .select()
    .single()
  if (error) wrapSupabaseError('', error)
  return data as Promotion
}

export async function updatePromotion(args: {
  id: string
  patch: Partial<Omit<Promotion, 'id' | 'createdAt'>>
}): Promise<Promotion> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('promotions')
    .update(args.patch)
    .eq('id', args.id)
    .select()
    .single()
  if (error) wrapSupabaseError('', error)
  return data as Promotion
}

export async function deletePromotion(args: { id: string }): Promise<{ id: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase.from('promotions').delete().eq('id', args.id)
  if (error) wrapSupabaseError('', error)
  return { id: args.id }
}

// ============================================================================
// Phase 43 — Hero carousel admin functions
// ============================================================================

/**
 * List ALL hero slides for the admin management UI (active + inactive).
 * Ordered by display_order ASC. Includes joined room_type / promotion
 * denormalized fields so the admin table can render source labels without
 * follow-up fetches.
 *
 * Uses admin client to bypass RLS (admin policy already covers it, but
 * admin client keeps the call uniform with other management pages).
 */
export async function listAllHeroSlides(): Promise<
  (HeroSlide & {
    room_type_name_th: string | null
    room_type_name: string | null
    promotion_name: string | null
  })[]
> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('hero_slides')
    .select(
      `
      *,
      room_type:room_types(name, name_th),
      promotion:promotions(name)
    `,
    )
    .order('display_order', { ascending: true })
  if (error) wrapSupabaseError('listAllHeroSlides', error)
  return (data ?? []).map((row) => {
    const rt = row.room_type as { name: string; name_th: string } | null
    const pr = row.promotion as { name: string } | null
    return {
      ...(row as HeroSlide),
      room_type_name_th: rt?.name_th ?? null,
      room_type_name: rt?.name ?? null,
      promotion_name: pr?.name ?? null,
    }
  })
}

/**
 * Toggle the `is_active` flag on a hero slide via the regular PostgREST
 * API. RLS admin write policy allows the update; defense-in-depth check
 * on session.role lives in the server action.
 */
export async function setHeroSlideActive(args: {
  slideId: string
  isActive: boolean
}): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('hero_slides')
    .update({ is_active: args.isActive })
    .eq('id', args.slideId)
  if (error) wrapSupabaseError('setHeroSlideActive', error)
}

/**
 * Delete a hero slide. Cascading FK to room_types / promotions will
 * remove the row automatically; this is just an explicit DELETE so the
 * admin UI has a clean call.
 */
export async function deleteHeroSlide(args: { slideId: string }): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase.from('hero_slides').delete().eq('id', args.slideId)
  if (error) wrapSupabaseError('deleteHeroSlide', error)
}

/**
 * Move a hero slide up or down in the display order. Delegates to the
 * SECURITY DEFINER RPC `move_hero_slide(uuid, smallint)` which does an
 * atomic swap under FOR UPDATE — see migration 20261005.
 */
export async function moveHeroSlide(args: {
  slideId: string
  direction: 'up' | 'down'
}): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const direction = args.direction === 'up' ? -1 : 1
  const { error } = await supabase.rpc('move_hero_slide', {
    p_slide_id: args.slideId,
    p_direction: direction,
  })
  if (error) wrapSupabaseError('moveHeroSlide', error)
}

/**
 * Append a new hero slide via the SECURITY DEFINER RPC. The RPC computes
 * the next display_order atomically (max + 1) so two concurrent admin
 * clicks can't both pick the same order.
 */
export async function appendHeroSlide(args: {
  sourceType: 'room_type' | 'promotion' | 'custom'
  roomTypeId?: string
  promotionId?: string
  customImageKey?: string
  customCaption?: string
  customCaptionTh?: string
  updatedBy: string
}): Promise<{ id: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('append_hero_slide', {
    p_source_type: args.sourceType,
    p_room_type_id: args.roomTypeId ?? null,
    p_promotion_id: args.promotionId ?? null,
    p_custom_image_key: args.customImageKey ?? null,
    p_custom_caption: args.customCaption ?? null,
    p_custom_caption_th: args.customCaptionTh ?? null,
    p_updated_by: args.updatedBy,
  })
  if (error) wrapSupabaseError('appendHeroSlide', error)
  return { id: data as string }
}

/**
 * Update a custom slide's caption (TH + EN). Only meaningful for
 * source_type='custom' — server action can validate if needed.
 */
export async function updateHeroSlideCaption(args: {
  slideId: string
  customCaption: string | null
  customCaptionTh: string | null
}): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('hero_slides')
    .update({
      custom_caption: args.customCaption,
      custom_caption_th: args.customCaptionTh,
    })
    .eq('id', args.slideId)
  if (error) wrapSupabaseError('updateHeroSlideCaption', error)
}

export async function updateHotelSettings(args: Partial<HotelSettings>): Promise<HotelSettings> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  // Singleton `id` is not user-editable — strip it from the patch.
  const { id: _id, ...patch } = args
  const { data, error } = await supabase
    .from('hotel_settings')
    .update(patch)
    .eq('id', 1)
    .select('*')
    .single()
  if (error) wrapSupabaseError('', error)
  return data as HotelSettings
}

/**
 * Close a room for maintenance. Refuses while a guest is staying in it —
 * the check-out trigger would otherwise flip it to waiting_cleaning and
 * silently undo the closure. Already-closed rooms are a no-op.
 */
export async function closeRoomUnit(args: { unitId: string }): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server')
  await closeRoomForMaintenance(await createClient(), args)
}

type ServerSupabase = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

/** Client-agnostic core of closeRoomUnit (the integration test passes a service client). */
export async function closeRoomForMaintenance(
  supabase: ServerSupabase,
  args: { unitId: string },
): Promise<void> {
  const [{ data: unit, error: unitErr }, { count: staying, error: stayErr }] = await Promise.all([
    supabase.from('room_units').select('status').eq('id', args.unitId).maybeSingle(),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('room_unit_id', args.unitId)
      .eq('status', 'checked_in'),
  ])
  if (unitErr) wrapSupabaseError('room_units', unitErr)
  if (stayErr) wrapSupabaseError('bookings', stayErr)
  if (!unit) throw new Error('ไม่พบห้องนี้')
  if (unit.status === 'occupied' || (staying ?? 0) > 0) {
    throw new Error('ห้องนี้มีแขกพักอยู่ — ปิดได้หลังเช็คเอาท์')
  }
  const { error } = await supabase
    .from('room_units')
    .update({ status: 'maintenance', updated_at: new Date().toISOString() })
    .eq('id', args.unitId)
    .not('status', 'in', '(maintenance,out_of_order)')
  if (error) wrapSupabaseError('room_units', error)
}

/**
 * Reopen a closed room. It goes to waiting_cleaning (not straight to
 * available) with one cleaning task, and any maintenance report still
 * in_progress for the room is resolved. Shared by the /manager/rates
 * reopen button and resolveMaintenanceReport so both paths behave the same.
 *
 * Order matters: the room leaves `maintenance` before the task is inserted,
 * because on_task_insert skips rooms that are still in maintenance.
 */
export async function reopenRoomForCleaning(
  supabase: ServerSupabase,
  args: { unitId: string; actorId: string },
): Promise<void> {
  const now = new Date().toISOString()
  const { error: roomErr } = await supabase
    .from('room_units')
    .update({ status: 'waiting_cleaning', updated_at: now })
    .eq('id', args.unitId)
    .in('status', ['maintenance', 'out_of_order'])
  if (roomErr) wrapSupabaseError('room_units', roomErr)

  const { count: openTasks, error: taskReadErr } = await supabase
    .from('housekeeping_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('room_unit_id', args.unitId)
    .in('status', ['unassigned', 'assigned', 'in_progress'])
  if (taskReadErr) wrapSupabaseError('housekeeping_tasks', taskReadErr)
  if ((openTasks ?? 0) === 0) {
    const { error: taskErr } = await supabase.from('housekeeping_tasks').insert({
      room_unit_id: args.unitId,
      task_type: 'cleaning',
      priority: 'normal',
      status: 'unassigned',
      assigned_to: null,
      created_by: args.actorId,
      booking_id: null,
    })
    if (taskErr) wrapSupabaseError('housekeeping_tasks', taskErr)
  }

  const { error: reportErr } = await supabase
    .from('maintenance_reports')
    .update({ status: 'resolved', resolved_at: now, updated_at: now })
    .eq('room_unit_id', args.unitId)
    .eq('status', 'in_progress')
  if (reportErr) wrapSupabaseError('maintenance_reports', reportErr)
}

export async function reopenRoomUnit(args: { unitId: string; actorId: string }): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  await reopenRoomForCleaning(supabase, args)
}

export async function setStaffActive(args: { staffId: string; isActive: boolean }): Promise<StaffMember> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: args.isActive })
    .eq('id', args.staffId)
    .select('id, full_name, email, phone, role, is_active, avatar_key, hired_at, created_at')
    .single()
  if (error) wrapSupabaseError('', error)
  return {
    id: data.id,
    full_name: data.full_name ?? '',
    email: data.email ?? '',
    role: data.role as StaffMember['role'],
    is_active: data.is_active,
    avatar_key: data.avatar_key ?? null,
    hired_at: data.hired_at ?? (data.created_at ? data.created_at.slice(0, 10) : '1970-01-01'),
    phone: data.phone ?? null,
  }
}

// Phase 7 — Admin CRUD (real implementations)
export async function createStaff(args: {
  full_name: string
  email: string
  role: StaffMember['role']
  phone: string | null
  password: string
}): Promise<{ staff: StaffMember; initialPassword: string }> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = await createAdminClient()

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
    user_metadata: { full_name: args.full_name, phone: args.phone },
  })
  if (authErr) throw new Error(`Auth: ${authErr.message}`)
  if (!authData.user) throw new Error('Auth: no user returned')

  // handle_new_user() trigger inserts a profile with role='user'. Override the role here.
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .update({ role: args.role, full_name: args.full_name, phone: args.phone })
    .eq('id', authData.user.id)
    .select('id, full_name, phone, role')
    .single()
  if (profErr) throw new Error(`Profile: ${profErr.message}`)

  return {
    staff: {
      id: profile.id,
      full_name: profile.full_name ?? args.full_name,
      email: args.email,
      role: profile.role as StaffMember['role'],
      is_active: true,
      avatar_key: null,
      hired_at: new Date().toISOString().slice(0, 10),
      phone: profile.phone,
    },
    initialPassword: args.password,
  }
}

export async function updateStaff(args: {
  id: string
  patch: Partial<Pick<StaffMember, 'full_name' | 'phone' | 'role' | 'is_active'>>
}): Promise<StaffMember> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(args.patch)
    .eq('id', args.id)
    .select('id, full_name, phone, role')
    .single()
  if (error) wrapSupabaseError('', error)
  return {
    id: data.id,
    full_name: data.full_name ?? '',
    email: '', // Email is in auth.users, not profiles — caller already knows it
    role: data.role as StaffMember['role'],
    is_active: true, // Reflected via separate call; server patches only the listed fields
    avatar_key: null,
    hired_at: new Date().toISOString().slice(0, 10),
    phone: data.phone,
  }
}

export async function countActiveAdmins(excludeId?: string): Promise<number> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  let q = supabase.from('profiles').select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true)
  if (excludeId) q = q.neq('id', excludeId)
  const { count, error } = await q
  if (error) wrapSupabaseError('', error)
  return count ?? 0
}

// Phase 7 — Seasonal Rate CRUD (real implementations)
export async function createSeasonalRate(
  args: Omit<SeasonalRate, 'id' | 'room_type_name'>,
): Promise<SeasonalRate> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('seasonal_rates')
    .insert({
      room_type_id: args.room_type_id,
      label: args.label,
      start_date: args.start_date,
      end_date: args.end_date,
      flat_price: args.flat_price,
      price_multiplier: args.price_multiplier,
      min_nights_override: args.min_nights_override,
      is_active: args.is_active,
      priority: args.priority,
    })
    .select(`*, room_type:room_types(name)`)
    .single()
  if (error) wrapSupabaseError('', error)
  const row = data as SeasonalRate & { room_type: { name: string } | null }
  return { ...row, room_type_name: row.room_type?.name }
}

export async function updateSeasonalRate(args: {
  id: string
  patch: Partial<Omit<SeasonalRate, 'id' | 'room_type_name'>>
}): Promise<SeasonalRate> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('seasonal_rates')
    .update(args.patch)
    .eq('id', args.id)
    .select(`*, room_type:room_types(name)`)
    .single()
  if (error) wrapSupabaseError('', error)
  const row = data as SeasonalRate & { room_type: { name: string } | null }
  return { ...row, room_type_name: row.room_type?.name }
}

export async function deleteSeasonalRate(args: { id: string }): Promise<{ id: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase.from('seasonal_rates').delete().eq('id', args.id)
  if (error) wrapSupabaseError('', error)
  return { id: args.id }
}

/**
 * Phase 8 — Pricing engine.
 * Returns active seasonal rates that overlap the booking window.
 * Uses standard date-overlap predicate: start_date <= checkOut AND end_date >= checkIn.
 */
export async function getActiveSeasonalRatesForRange(args: {
  roomTypeId: string
  checkIn: string
  checkOut: string
}): Promise<SeasonalRate[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('seasonal_rates')
    .select('*')
    .eq('room_type_id', args.roomTypeId)
    .eq('is_active', true)
    .lte('start_date', args.checkOut)
    .gte('end_date', args.checkIn)
    .order('priority', { ascending: false })
  if (error) wrapSupabaseError('', error)
  return (data ?? []) as SeasonalRate[]
}
