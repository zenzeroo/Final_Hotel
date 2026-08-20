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
