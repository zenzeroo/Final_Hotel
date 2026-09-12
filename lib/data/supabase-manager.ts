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
  HotelSettings,
  RoomUnitWithType,
  SeasonalRate,
  CancellationPolicy,
  OccupancyMonthPoint,
  RankedRoom,
  RankedRoomTypeRevenue,
  ChannelSlice,
  HousekeeperOption,
  HousekeeperCard,
  AssignedTaskCard,
  HousekeeperWorkload,
} from './types'
import { wrapSupabaseError } from '@/lib/errors/supabase'

// =========================================================
// Phase 9 — Date helpers (ISO day boundaries in the server's TZ).
// The mock layer uses JS Date arithmetic in UTC; the live layer should
// match by always slicing on YYYY-MM-DD via the database's `::date` cast
// or a precomputed ISO prefix passed via the JS Date.
// =========================================================

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

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

  const today = todayIso()
  const yesterday = isoDaysAgo(1)
  const sevenDaysAgo = isoDaysAgo(6) // inclusive: today + 6 prior days = 7 buckets

  // Parallel queries — JS client multiplexes over a single HTTP/2 connection.
  const [
    { data: revenueTodayRows, error: e1 },
    { error: e2 },
    { count: checkInsToday, error: e3 },
    { count: checkOutsToday, error: e4 },
    { count: newBookingsToday, error: e5 },
    { count: inHouseBookings, error: e6 },
    { count: totalActiveRooms, error: e7 },
    { data: weekRows, error: e8 },
    { data: urgentDamages, error: e9 },
    { data: pendingRefunds, error: e10 },
    { count: webBookings, error: e11 },
    { count: walkInBookings, error: e12 },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('total')
      .gte('created_at', today + 'T00:00:00Z')
      .lt('created_at', today + 'T23:59:59Z')
      .neq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterday + 'T00:00:00Z')
      .lt('created_at', yesterday + 'T23:59:59Z')
      .neq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('check_in', today)
      .in('status', ['confirmed', 'checked_in']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('check_out', today),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00Z')
      .lt('created_at', today + 'T23:59:59Z'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .lte('check_in', today)
      .gt('check_out', today)
      .in('status', ['confirmed', 'checked_in']),
    supabase
      .from('room_units')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('bookings')
      .select('total, created_at')
      .gte('created_at', sevenDaysAgo + 'T00:00:00Z')
      .lte('created_at', today + 'T23:59:59Z')
      .neq('status', 'cancelled'),
    supabase
      .from('damage_reports')
      .select('id, room_unit_id')
      .eq('resolved', false)
      .eq('severity', 'urgent')
      .limit(5),
    supabase
      .from('refund_requests')
      .select('id, amount')
      .eq('status', 'pending')
      .limit(5),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00Z')
      .lt('created_at', today + 'T23:59:59Z')
      .eq('channel', 'web'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00Z')
      .lt('created_at', today + 'T23:59:59Z')
      .eq('channel', 'walk_in'),
  ])

  for (const [label, e] of [
    ['revenueToday', e1],
    ['revenueYesterday', e2],
    ['checkInsToday', e3],
    ['checkOutsToday', e4],
    ['newBookingsToday', e5],
    ['inHouseBookings', e6],
    ['totalActiveRooms', e7],
    ['weekRows', e8],
    ['urgentDamages', e9],
    ['pendingRefunds', e10],
    ['webBookings', e11],
    ['walkInBookings', e12],
  ] as const) {
    if (e) wrapSupabaseError(label, e)
  }

  const revenueToday = (revenueTodayRows ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0)
  // Revenue trend is computed from created_at day-buckets above (weekRows),
  // not from the (unused) revenueYesterday count.
  const trendPct = computeDayOverDayTrend(weekRows ?? [], today, yesterday)
  const occupancyRatePct =
    totalActiveRooms && totalActiveRooms > 0
      ? Math.round(((inHouseBookings ?? 0) / totalActiveRooms) * 100)
      : 0

  // Aggregate the 7-day window into daily revenue buckets.
  const revenue7d = bucketRevenue7d(weekRows ?? [], today)

  const alerts: DashboardAlert[] = []
  for (const d of urgentDamages ?? []) {
    alerts.push({
      id: 'damage-' + d.id,
      severity: 'critical',
      title: 'ด่วน: รายงานความเสียหาย',
      description: 'ห้องพักมีรายงานความเสียหายที่ยังไม่ได้รับการแก้ไข',
      cta: { label: 'ดูรายงาน', href: '/manager/housekeeping' },
    })
  }
  for (const r of pendingRefunds ?? []) {
    alerts.push({
      id: 'refund-' + r.id,
      severity: 'warning',
      title: 'คำขอคืนเงินรออนุมัติ',
      description: 'มีคำขอคืนเงินที่รอการตัดสินใจ',
      cta: { label: 'ดูคำขอ', href: '/manager/bookings?tab=refunds' },
    })
  }

  return {
    revenueToday,
    revenueTrendPct: trendPct,
    occupancyRatePct,
    checkInsToday: checkInsToday ?? 0,
    checkOutsToday: checkOutsToday ?? 0,
    newBookingsToday: newBookingsToday ?? 0,
    // Phase 12: real channel split from bookings.channel column.
    // webBookings + walkInBookings may each be 0 on a quiet day; the KPI
    // strip renders Web + Walk-in numbers independently.
    webBookings: webBookings ?? 0,
    walkInBookings: walkInBookings ?? 0,
    revenue7d,
    alerts,
  }
}

function computeDayOverDayTrend(
  rows: { total: number; created_at: string }[],
  today: string,
  yesterday: string,
): number {
  let todayTotal = 0
  let yesterdayTotal = 0
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    if (day === today) todayTotal += r.total ?? 0
    else if (day === yesterday) yesterdayTotal += r.total ?? 0
  }
  if (yesterdayTotal === 0) return todayTotal > 0 ? 100 : 0
  return ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
}

function bucketRevenue7d(
  rows: { total: number; created_at: string }[],
  today: string,
): RevenueBarPoint[] {
  const buckets: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) buckets[isoDaysAgo(i)] = 0
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    if (day in buckets) buckets[day] += r.total ?? 0
  }
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return Object.entries(buckets).map(([date, revenue]) => {
    const d = new Date(date + 'T00:00:00Z')
    const isToday = date === today
    return {
      date,
      revenue,
      label: isToday ? 'Today' : dayLabels[d.getUTCDay()] ?? '',
    }
  })
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
  const today = todayIso()
  const [
    { data: damageRows, error: e1 },
    { data: rooms, error: e2 },
    { data: unassignedTasksRaw, error: e3 },
    { data: activeTasks, error: e4 },
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
    supabase
      .from('housekeeping_tasks')
      .select(
        `
        room_unit_id, assigned_to, status,
        room_unit:room_units!inner(floor),
        assignee:profiles!housekeeping_tasks_assigned_to_fkey(full_name)
      `,
      )
      .in('status', ['assigned', 'in_progress']),
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
    ['activeTasks', e4],
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
  // `available` and `occupied` both render as 'inspected' (ready state) since
  // the floor grid only distinguishes clean/cleaning/dirty. Phase 30.1:
  // widened to cover all 9 DB enum values (was 5 — `inspection`/`ready`/
  // `checkout` were falling through to `?? 'dirty'` fallback, double-
  // counting cleaned/inspected rooms as dirty in the KPI).
  const ROOM_TO_FLOOR_STATUS: Record<string, 'dirty' | 'cleaning' | 'inspected'> = {
    available: 'inspected',
    occupied: 'inspected',
    cleaning: 'cleaning',
    inspection: 'cleaning',          // HK in-progress inspection = actively being inspected
    ready: 'inspected',              // post-inspection ready = clean
    waiting_cleaning: 'dirty',       // dirty queue, awaiting HK
    checkout: 'dirty',               // guest just left, pre-clean queue
    maintenance: 'dirty',
    out_of_order: 'dirty',
  }
  let dirtyCount = 0
  let cleaningCount = 0
  let inspectedCount = 0
  for (const r of rooms ?? []) {
    const s = ROOM_TO_FLOOR_STATUS[r.status] ?? 'dirty'
    if (s === 'dirty') dirtyCount++
    else if (s === 'cleaning') cleaningCount++
    else inspectedCount++
  }

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
  for (const t of activeTasks ?? []) {
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
        label: `Floor ${floor}`,
        assignedTo: a?.name ?? null,
        rooms: cells,
      }
    })

  // Floor assignments: count rooms per floor + (persisted or derived) housekeeper.
  const floorAssignments: FloorAssignment[] = floors.map((f) => ({
    floor: f.floor,
    label: f.label,
    totalRooms: f.rooms.length,
    housekeeperId: floorAssignee.get(f.floor)?.id ?? null,
    housekeeperName: floorAssignee.get(f.floor)?.name ?? null,
  }))

  const unassignedTasks: UnassignedTask[] = (unassignedTasksRaw ?? []).map((t) => {
    const ru = Array.isArray(t.room_unit) ? t.room_unit[0] : t.room_unit
    return {
      id: t.id,
      title: t.task_type.replace(/_/g, ' '),
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

  // Phase 30 — build housekeeperWorkloads for the WorkloadTable (includes HKs
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
    dirtyCount,
    cleaningCount,
    inspectedCount,
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
  const today = todayIso()
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
    const role = actor?.role ?? 'system'
    const staffId = actor?.full_name ?? 'system'
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
      staffId: role === 'manager' || role === 'admin' ? staffId : `MGR-${role.toUpperCase()}`,
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

export async function getReportsData(): Promise<ReportsData> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const today = todayIso()
  const sevenDaysAgo = isoDaysAgo(6)
  const fourteenDaysAgo = isoDaysAgo(13)
  // Phase 12: live GROUP BY for the 5 analytics arrays. No precomputed
  // analytics tables — relies on the 2 new indexes from migration 20260834:
  //   idx_bookings_checkin_status, idx_bookings_roomtype_status.
  const thirtyDaysAgo = isoDaysAgo(29)
  // Same 30-day window one year prior for occupancyYoY.
  const lastYearToday = new Date(today + 'T00:00:00Z')
  lastYearToday.setUTCFullYear(lastYearToday.getUTCFullYear() - 1)
  const lastYearThirtyAgo = new Date(thirtyDaysAgo + 'T00:00:00Z')
  lastYearThirtyAgo.setUTCFullYear(lastYearThirtyAgo.getUTCFullYear() - 1)
  const lastYearTodayIso = lastYearToday.toISOString().slice(0, 10)
  const lastYearThirtyAgoIso = lastYearThirtyAgo.toISOString().slice(0, 10)

  const [
    { data: last7Rows, error: e1 },
    { data: prev7Rows, error: e2 },
    { data: last7Cancelled, error: e3 },
    { data: prev7Cancelled, error: e4 },
    { count: totalBookings7d, error: e5 },
    { data: dailyRevenueRows, error: e6 },
    { data: currentMonthRows, error: e7 },
    { data: priorYearRows, error: e8 },
    { data: roomTypeRows, error: e9 },
    { data: channelRows, error: e10 },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('total, created_at')
      .gte('created_at', sevenDaysAgo + 'T00:00:00Z')
      .lte('created_at', today + 'T23:59:59Z')
      .neq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select('total')
      .gte('created_at', fourteenDaysAgo + 'T00:00:00Z')
      .lt('created_at', sevenDaysAgo + 'T00:00:00Z')
      .neq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo + 'T00:00:00Z')
      .lte('created_at', today + 'T23:59:59Z')
      .eq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', fourteenDaysAgo + 'T00:00:00Z')
      .lt('created_at', sevenDaysAgo + 'T00:00:00Z')
      .eq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo + 'T00:00:00Z')
      .lte('created_at', today + 'T23:59:59Z'),
    // dailyRevenue: 7-day window keyed on check_in (not created_at — that's
    // when the booking was made, not when revenue was earned). Includes
    // confirmed + checked_out (i.e. realised revenue; pending is excluded
    // because the guest may still cancel).
    supabase
      .from('bookings')
      .select('check_in, total')
      .gte('check_in', sevenDaysAgo)
      .lte('check_in', today)
      .in('status', ['confirmed', 'checked_out']),
    // occupancyYoY: current 30-day booking count + same range 1 year prior.
    supabase
      .from('bookings')
      .select('check_in', { count: 'exact' })
      .gte('check_in', thirtyDaysAgo)
      .lte('check_in', today)
      .in('status', ['confirmed', 'checked_in', 'checked_out']),
    supabase
      .from('bookings')
      .select('check_in', { count: 'exact' })
      .gte('check_in', lastYearThirtyAgoIso)
      .lte('check_in', lastYearTodayIso)
      .in('status', ['confirmed', 'checked_in', 'checked_out']),
    // mostBookedRooms + highestRevenueRoomTypes: GROUP BY room_type_id with
    // the embedded room_type name for label. SELECT only the columns we need
    // to keep the row size small.
    supabase
      .from('bookings')
      .select('room_type_id, total, room_type:room_types(name)')
      .in('status', ['confirmed', 'checked_in', 'checked_out']),
    // channels: GROUP BY channel — used for the donut chart.
    supabase.from('bookings').select('channel'),
  ])
  for (const [label, e] of [
    ['last7Rows', e1],
    ['prev7Rows', e2],
    ['last7Cancelled', e3],
    ['prev7Cancelled', e4],
    ['totalBookings7d', e5],
    ['dailyRevenueRows', e6],
    ['currentMonthRows', e7],
    ['priorYearRows', e8],
    ['roomTypeRows', e9],
    ['channelRows', e10],
  ] as const) {
    if (e) wrapSupabaseError(label, e)
  }

  const totalRevenue7d = (last7Rows ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0)
  const prev7Revenue = (prev7Rows ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0)

  // Phase 10: real percent change vs prior 7-day window. Round to whole pct.
  // If prior was 0 and current is positive, show +100% (consistent with how
  // cancellationTrendPct handles the same edge case below).
  const totalRevenueTrendPct =
    prev7Revenue === 0
      ? totalRevenue7d > 0
        ? 100
        : 0
      : Math.round(((totalRevenue7d - prev7Revenue) / prev7Revenue) * 100)

  const last7TotalCount = (totalBookings7d as number | null) ?? 0
  const last7CancelledCount = (last7Cancelled as number | null) ?? 0
  const prev7CancelledCount = (prev7Cancelled as number | null) ?? 0

  const cancellationRatePct =
    last7TotalCount > 0 ? Math.round((last7CancelledCount / last7TotalCount) * 100) : 0
  const cancellationTrendPct =
    prev7CancelledCount === 0
      ? last7CancelledCount > 0
        ? 100
        : 0
      : Math.round(((last7CancelledCount - prev7CancelledCount) / prev7CancelledCount) * 100)

  // ── dailyRevenue: bucket client-side (matches bucketRevenue7d pattern) ──
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dailyBuckets: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) dailyBuckets[isoDaysAgo(i)] = 0
  for (const r of dailyRevenueRows ?? []) {
    const day = r.check_in
    if (day in dailyBuckets) dailyBuckets[day] += r.total ?? 0
  }
  const dailyRevenue: RevenueBarPoint[] = Object.entries(dailyBuckets).map(([date, revenue]) => {
    const d = new Date(date + 'T00:00:00Z')
    const isToday = date === today
    return {
      date,
      revenue,
      label: isToday ? 'Today' : dayLabels[d.getUTCDay()] ?? '',
    }
  })

  // ── occupancyYoY: system is < 1 year old in most installs → prior is 0
  // rows. Return [] in that case. Otherwise build a single point comparing
  // current 30d to the same window last year. ──
  const priorCount = Array.isArray(priorYearRows) ? priorYearRows.length : 0
  const currentCount = Array.isArray(currentMonthRows) ? currentMonthRows.length : 0
  const occupancyYoY: OccupancyMonthPoint[] =
    priorCount === 0
      ? []
      : [
          {
            month: today.slice(0, 7), // YYYY-MM
            last: Math.min(100, Math.round((priorCount / 30) * 100)),
            current: Math.min(100, Math.round((currentCount / 30) * 100)),
          },
        ]

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
  // Fixed palette per channel — single source of truth for chart colors.
  const channelPalette: Record<string, string> = {
    web: '#3b82f6',
    walk_in: '#10b981',
    phone: '#f59e0b',
    ota: '#a855f7',
  }
  const channelLabels: Record<string, string> = {
    web: 'Online',
    walk_in: 'Walk-in',
    phone: 'Phone',
    ota: 'OTA',
  }
  const channels: ChannelSlice[] = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      label: channelLabels[key] ?? key,
      percent: channelTotal > 0 ? Math.round((count / channelTotal) * 100) : 0,
      color: channelPalette[key] ?? '#94a3b8',
    }))

  return {
    totalRevenue7d,
    totalRevenueTrendPct,
    // Phase 12: live aggregation. Empty arrays only when the underlying query
    // returned 0 rows (e.g. a brand-new install with no bookings yet).
    dailyRevenue,
    occupancyYoY,
    mostBookedRooms,
    highestRevenueRoomTypes,
    channels,
    totalBookings7d: last7TotalCount,
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

export async function listShifts(): Promise<ShiftSlot[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const today = todayIso()
  const weekFromNow = isoDaysAgo(-6) // today + 6 days
  const { data, error } = await supabase
    .from('staff_shifts')
    .select('staff_id, shift_date, position')
    .gte('shift_date', today)
    .lte('shift_date', weekFromNow)
    .order('shift_date', { ascending: true })
  if (error) wrapSupabaseError('', error)
  return (data ?? []).map((r) => ({
    staffId: r.staff_id,
    date: r.shift_date,
    position: r.position as ShiftSlot['position'],
  }))
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

export async function closeRoomUnit(args: { unitId: string }): Promise<RoomUnitWithType> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('room_units')
    .update({ status: 'maintenance' })
    .eq('id', args.unitId)
    .select(`
      id, floor, unit_label, view_label, status,
      room_type:room_types(id, slug, name, name_th, base_price, hero_image_key)
    `)
    .single()
  if (error) wrapSupabaseError('', error)
  return data as unknown as RoomUnitWithType
}

export async function reopenRoomUnit(args: { unitId: string }): Promise<RoomUnitWithType> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('room_units')
    .update({ status: 'available' })
    .eq('id', args.unitId)
    .select(`
      id, floor, unit_label, view_label, status,
      room_type:room_types(id, slug, name, name_th, base_price, hero_image_key)
    `)
    .single()
  if (error) wrapSupabaseError('', error)
  return data as unknown as RoomUnitWithType
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
