/**
 * Data layer types — shared between mock and Supabase implementations.
 */

export type BedType = 'King' | 'Queen' | 'Twin'
export type RoomTypeName = 'Deluxe' | 'Suite' | 'Villa'

export interface RoomType {
  id: string
  slug: string
  name: string
  name_th: string
  short_desc: string
  description: string
  base_price: number // THB per night
  max_guests: number
  size_sqm: number
  bed_type: BedType
  floor: number
  view_label?: string
  rating_avg: number
  rating_count: number
  hero_image_key: string
  gallery_keys: string[]
  amenities: string[] // amenity slugs
  type: RoomTypeName
  is_active: boolean
}

export interface Amenity {
  slug: string
  name: string
  name_th: string
  icon: string // material symbol name
  category: 'comfort' | 'tech' | 'service'
}

export interface SearchFilters {
  checkin?: string // ISO date YYYY-MM-DD
  checkout?: string
  guests?: number
  type?: RoomTypeName | 'all'
  floor?: number | 'all'
  priceRange?: 'under3000' | '3000-6000' | 'over6000' | 'all'
}

export interface SearchResult {
  rooms: RoomType[]
  total: number
}

// =====================================================
// Housekeeping types
// =====================================================
export type HousekeepingTaskType = 'cleaning' | 'turn_down' | 'deep_clean' | 'inspection' | 'restock'
export type HousekeepingTaskStatus = 'unassigned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
export type HousekeepingTaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export type RoomUnitStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'out_of_order'

export interface RoomUnitBasic {
  id: string
  floor: number
  unit_label: string
  view_label: string | null
  status: RoomUnitStatus
  room_type?: {
    id: string
    name: string
    name_th: string | null
    hero_image_key: string | null
  }
}

export interface HousekeepingTask {
  id: string
  room_unit_id: string
  task_type: HousekeepingTaskType
  priority: HousekeepingTaskPriority
  status: HousekeepingTaskStatus
  assigned_to: string | null
  created_by: string
  booking_id: string | null
  notes: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  room_unit?: RoomUnitBasic
  assigned_user?: { full_name: string | null } | null
  created_user?: { full_name: string | null } | null
}

// =====================================================
// Maintenance types
// =====================================================
export type MaintenanceIssueType = 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliance' | 'other'
export type MaintenanceSeverity = 'low' | 'medium' | 'high' | 'critical'
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved'

export interface MaintenanceReport {
  id: string
  room_unit_id: string
  issue_type: MaintenanceIssueType
  severity: MaintenanceSeverity
  status: MaintenanceStatus
  title: string
  description: string | null
  reported_by: string
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  room_unit?: RoomUnitBasic
  reporter?: { full_name: string | null } | null
}

export interface DashboardStats {
  roomsToClean: number
  shiftProgress: number
  myTasksCount: number
  maintenanceOpenCount: number
  priorityTasks: HousekeepingTask[]
  activeTasks: HousekeepingTask[]
}

export interface WorkHistoryData {
  roomsCleaned: number
  avgMinutes: number | null
  tasksToday: number
  tasksThisWeek: number
  dailyPerformance: { date: string; count: number }[]
  recentLog: HousekeepingTask[]
}

// =====================================================
// Manager types — Dashboard
// =====================================================
export type DashboardAlertSeverity = 'critical' | 'warning' | 'info'

export interface DashboardAlert {
  id: string
  severity: DashboardAlertSeverity
  title: string
  description: string
  cta?: { label: string; href?: string }
}

export interface RevenueBarPoint {
  date: string // YYYY-MM-DD
  revenue: number
  label?: string // 'Mon', 'Tue' ...
}

export interface ManagerDashboardStats {
  revenueToday: number
  revenueTrendPct: number
  occupancyRatePct: number
  checkInsToday: number
  checkOutsToday: number
  newBookingsToday: number
  webBookings: number
  walkInBookings: number
  revenue7d: RevenueBarPoint[]
  alerts: DashboardAlert[]
}

// =====================================================
// Manager types — Housekeeping Overview
// =====================================================
export type FloorRoomStatus = 'dirty' | 'cleaning' | 'inspected'

export interface RoomStatusCell {
  roomNumber: string
  status: FloorRoomStatus
  occupied: boolean
}

export interface FloorStatusGroup {
  floor: number
  label: string
  assignedTo: string | null
  rooms: RoomStatusCell[]
}

export interface FloorAssignment {
  floor: number
  label: string
  totalRooms: number
  housekeeperId: string | null
  housekeeperName: string | null
}

export interface UnassignedTask {
  id: string
  title: string
  roomNumber: string
  requestedAt: string
  urgent: boolean
}

export type DamageSeverity = 'normal' | 'urgent'

export interface DamageReport {
  id: string
  roomNumber: string
  reportedBy: string
  description: string
  photoUrl: string | null
  severity: DamageSeverity
  costEstimate: number | null
  resolved: boolean
  resolvedBy?: string | null
  resolvedAt?: string | null
  resolutionNote?: string | null
}

export interface HousekeepingOverviewData {
  totalRooms: number
  dirtyCount: number
  cleaningCount: number
  inspectedCount: number
  floors: FloorStatusGroup[]
  floorAssignments: FloorAssignment[]
  unassignedTasks: UnassignedTask[]
  damageReports: DamageReport[]
}

// =====================================================
// Manager types — Bookings Oversight
// =====================================================
export type BookingOversightStatus = 'paid' | 'pending' | 'cancelled' | 'refunded'

export interface BookingOversightRow {
  id: string
  code: string
  guestName: string
  guestInitials: string
  avatarBgClass: string
  roomNumber: string
  roomType: string
  checkIn: string
  checkOut: string
  nights: number
  status: BookingOversightStatus
}

export interface RefundRequest {
  id: string
  bookingCode: string
  guestName: string
  reason: string
  amount: number // THB
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  staffId: string
  action: string
  actionBadgeClass: string
  targetCode: string
  details: string
}

export interface BookingsOversightData {
  activeCount: number
  bookings: BookingOversightRow[]
  refundRequests: RefundRequest[]
  auditLog: AuditLogEntry[]
}

// =====================================================
// Manager types — Reports & Analytics
// =====================================================
export interface OccupancyMonthPoint {
  month: string
  last: number // last year %
  current: number // current year %
}

export interface RankedRoom {
  name: string
  count: number
}

export interface RankedRoomTypeRevenue {
  name: string
  revenue: number
}

export interface ChannelSlice {
  label: string
  percent: number
  color: string
}

export interface ReportsData {
  totalRevenue7d: number
  totalRevenueTrendPct: number
  dailyRevenue: RevenueBarPoint[]
  occupancyYoY: OccupancyMonthPoint[]
  mostBookedRooms: RankedRoom[]
  highestRevenueRoomTypes: RankedRoomTypeRevenue[]
  channels: ChannelSlice[]
  totalBookings7d: number
  cancellationRatePct: number
  cancellationTrendPct: number
}

// =====================================================
// Reviews & Ratings (Phase 5)
// =====================================================
export type ReviewStatus = 'pending' | 'approved' | 'hidden'

export interface PublicReview {
  id: string
  rating: number // 1..5
  title: string | null
  body: string | null
  createdAt: string
  guestName: string
  guestInitials: string
  avatarBgClass: string
}

export interface ReviewForModeration extends PublicReview {
  status: ReviewStatus
  roomTypeId: string
  roomTypeName: string
  bookingId: string | null
  bookingCode: string | null
  userId: string
  moderatedBy: string | null
  moderatedAt: string | null
}

export interface ReviewQueueData {
  pending: ReviewForModeration[]
  approved: ReviewForModeration[]
  hidden: ReviewForModeration[]
  pendingCount: number
  approvedCount: number
  hiddenCount: number
}

// =====================================================
// Manager types — Phase 6 (Settings, Promotions, Staff, Rates)
// =====================================================
export type DiscountType = 'percent' | 'flat'

export interface Promotion {
  id: string
  code: string
  name: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  min_nights: number
  valid_from: string // YYYY-MM-DD
  valid_until: string // YYYY-MM-DD
  is_active: boolean
  createdAt?: string
  updatedAt?: string
}

export type StaffRole = 'reception' | 'housekeeper' | 'manager'

export interface StaffMember {
  id: string
  full_name: string
  email: string
  role: StaffRole
  is_active: boolean
  avatar_key: string | null
  hired_at: string // YYYY-MM-DD
}

export type ShiftPosition = 'morning' | 'afternoon' | 'evening' | 'off'

export interface ShiftSlot {
  staffId: string
  date: string // YYYY-MM-DD
  position: ShiftPosition
}

export interface HotelSettings {
  id: 1 // singleton — id always 1
  name: string
  name_th: string | null
  address: string
  phone: string
  email: string
  tax_rate: number // 0..1
  resort_fee: number // THB
  currency: string
  check_in_time: string // HH:MM
  check_out_time: string // HH:MM
  locale_default: string
  hero_image_key: string | null
  updated_at: string
  updated_by: string | null
}

export interface RoomUnitWithType {
  id: string
  floor: number
  unit_label: string
  view_label: string | null
  status: RoomUnitStatus
  room_type: {
    id: string
    slug: string
    name: string
    name_th: string | null
    base_price: number
    hero_image_key: string | null
  }
}

export interface SeasonalRate {
  id: string
  room_type_id: string
  room_type_name?: string // for display in manager preview
  label: string
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  flat_price: number | null
  price_multiplier: number | null
  min_nights_override: number | null
  is_active: boolean
  priority: number
}

export interface CancellationPolicy {
  id: string
  name: string
  free_cancel_hours: number // hours before check-in for free cancellation
  refund_pct: number // 0..100
  description: string
}
