import type {
  ManagerDashboardStats,
  HousekeepingOverviewData,
  BookingsOversightData,
  ReportsData,
  DamageReport,
  Promotion,
  StaffMember,
  ShiftSlot,
  ShiftPosition,
  HotelSettings,
  RoomUnitWithType,
  SeasonalRate,
  CancellationPolicy,
} from './types'
import mockData from '@/data/mock-manager.json'

// Cast helpers — JSON imports widen string unions to plain `string`,
// so each top-level read is asserted to the strongly-typed shape.
const typed = mockData as {
  dashboard: ManagerDashboardStats
  housekeepingOverview: Omit<HousekeepingOverviewData, 'damageReports'> & {
    damageReports: DamageReport[]
  }
  bookingsOversight: Omit<BookingsOversightData, 'refundRequests'> & {
    refundRequests: BookingsOversightData['refundRequests']
  }
  reports: ReportsData
}

// =========================================================
// Seeded data — Settings, Promotions, Staff, Rates
// Module-scope mutable `state` mirrors mutations across requests during dev.
// =========================================================

const SERENITY_ID = '00000000-0000-0000-0000-000000000001'
const BOTANIC_ID = '00000000-0000-0000-0000-000000000002'
const HERITAGE_ID = '00000000-0000-0000-0000-000000000004'

const SERENITY_TYPE = {
  id: SERENITY_ID,
  slug: 'serenity-suite',
  name: 'Serenity Suite',
  name_th: 'ห้องสวีทความสงบ',
  base_price: 6800,
  hero_image_key: 'rooms/serenity-suite/hero.webp',
}

const BOTANIC_TYPE = {
  id: BOTANIC_ID,
  slug: 'botanic-king',
  name: 'Botanic King',
  name_th: 'ห้องคิงโรงพฤกษ์',
  base_price: 5400,
  hero_image_key: 'rooms/botanic-king/hero.webp',
}

const HERITAGE_TYPE = {
  id: HERITAGE_ID,
  slug: 'heritage-twin',
  name: 'Heritage Twin',
  name_th: 'ห้องเฮอริเทจทวิน',
  base_price: 7900,
  hero_image_key: 'rooms/heritage-twin/hero.webp',
}

const seedPromotions: Promotion[] = [
  {
    id: 'p-001',
    code: 'EARLY15',
    name: 'Early Bird 15%',
    description: 'จองล่วงหน้า 30 วัน รับส่วนลด 15%',
    discount_type: 'percent',
    discount_value: 15,
    min_nights: 2,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    is_active: true,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'p-002',
    code: 'WELCOME10',
    name: 'Welcome 10%',
    description: 'ส่วนลดต้อนรับแขกใหม่ 10%',
    discount_type: 'percent',
    discount_value: 10,
    min_nights: 1,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    is_active: true,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'p-003',
    code: 'SUMMER25',
    name: 'Summer 25%',
    description: 'โปรโมชั่นฤดูร้อน ลด 25%',
    discount_type: 'percent',
    discount_value: 25,
    min_nights: 3,
    valid_from: '2026-04-01',
    valid_until: '2026-06-30',
    is_active: false,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'p-004',
    code: 'LOYAL20',
    name: 'Loyalty 20%',
    description: 'ส่วนลดลูกค้าประจำ 20%',
    discount_type: 'percent',
    discount_value: 20,
    min_nights: 2,
    valid_from: '2026-01-01',
    valid_until: '2027-12-31',
    is_active: true,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
]

const seedStaff: StaffMember[] = [
  {
    id: 's-001',
    full_name: 'สมชาย ใจดี',
    email: 'somchai@zenzero.test',
    role: 'manager',
    is_active: true,
    avatar_key: null,
    hired_at: '2024-01-15',
    phone: '+66 81 234 5678',
  },
  {
    id: 's-002',
    full_name: 'ปิยะ รัตนา',
    email: 'piya@zenzero.test',
    role: 'reception',
    is_active: true,
    avatar_key: null,
    hired_at: '2024-06-01',
    phone: '+66 82 345 6789',
  },
  {
    id: 's-003',
    full_name: 'วรัญ สุขใส',
    email: 'waran@zenzero.test',
    role: 'reception',
    is_active: true,
    avatar_key: null,
    hired_at: '2025-02-10',
    phone: '+66 83 456 7890',
  },
  {
    id: 's-004',
    full_name: 'มาลี ขยันยิ่ง',
    email: 'malee@zenzero.test',
    role: 'housekeeper',
    is_active: true,
    avatar_key: null,
    hired_at: '2024-09-20',
    phone: '+66 84 567 8901',
  },
  {
    id: 's-005',
    full_name: 'นภา เรียบร้อย',
    email: 'napa@zenzero.test',
    role: 'housekeeper',
    is_active: false,
    avatar_key: null,
    hired_at: '2024-03-12',
    phone: null,
  },
]

const seedSettings: HotelSettings = {
  id: 1,
  name: 'Zenzero Hotel',
  name_th: 'โรงแรมเซ็นเซโร',
  address: '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
  phone: '+66 2 123 4567',
  email: 'info@zenzero.test',
  tax_rate: 0.07,
  resort_fee: 150,
  currency: 'THB',
  check_in_time: '15:00',
  check_out_time: '11:00',
  locale_default: 'th',
  hero_image_key: null,
  updated_at: '2026-08-22T00:00:00Z',
  updated_by: null,
}

const seedRoomUnits: RoomUnitWithType[] = [
  { id: 'u-101', floor: 1, unit_label: '101', view_label: 'Pool View', status: 'occupied', room_type: SERENITY_TYPE },
  { id: 'u-102', floor: 1, unit_label: '102', view_label: 'Pool View', status: 'available', room_type: SERENITY_TYPE },
  { id: 'u-103', floor: 1, unit_label: '103', view_label: 'Pool View', status: 'cleaning', room_type: BOTANIC_TYPE },
  { id: 'u-104', floor: 1, unit_label: '104', view_label: 'Pool View', status: 'maintenance', room_type: HERITAGE_TYPE },
  { id: 'u-201', floor: 2, unit_label: '201', view_label: 'Garden View', status: 'available', room_type: BOTANIC_TYPE },
  { id: 'u-202', floor: 2, unit_label: '202', view_label: 'Garden View', status: 'occupied', room_type: BOTANIC_TYPE },
  { id: 'u-203', floor: 2, unit_label: '203', view_label: 'Garden View', status: 'occupied', room_type: HERITAGE_TYPE },
  { id: 'u-204', floor: 2, unit_label: '204', view_label: 'Garden View', status: 'available', room_type: SERENITY_TYPE },
  { id: 'u-301', floor: 3, unit_label: '301', view_label: 'Forest View', status: 'cleaning', room_type: HERITAGE_TYPE },
  { id: 'u-302', floor: 3, unit_label: '302', view_label: 'Forest View', status: 'out_of_order', room_type: SERENITY_TYPE },
  { id: 'u-303', floor: 3, unit_label: '303', view_label: 'Forest View', status: 'available', room_type: SERENITY_TYPE },
  { id: 'u-304', floor: 3, unit_label: '304', view_label: 'Forest View', status: 'occupied', room_type: BOTANIC_TYPE },
]

const seedSeasonalRates: SeasonalRate[] = [
  {
    id: 'sr-001',
    room_type_id: SERENITY_ID,
    room_type_name: SERENITY_TYPE.name,
    label: 'New Year Surcharge',
    start_date: '2026-12-28',
    end_date: '2027-01-03',
    flat_price: 9500,
    price_multiplier: null,
    min_nights_override: 3,
    is_active: true,
    priority: 10,
  },
  {
    id: 'sr-002',
    room_type_id: BOTANIC_ID,
    room_type_name: BOTANIC_TYPE.name,
    label: 'Songkran Promotion',
    start_date: '2026-04-10',
    end_date: '2026-04-20',
    flat_price: null,
    price_multiplier: 0.85,
    min_nights_override: null,
    is_active: true,
    priority: 5,
  },
  {
    id: 'sr-003',
    room_type_id: HERITAGE_ID,
    room_type_name: HERITAGE_TYPE.name,
    label: 'Low Season',
    start_date: '2026-09-01',
    end_date: '2026-10-31',
    flat_price: null,
    price_multiplier: 0.75,
    min_nights_override: null,
    is_active: true,
    priority: 1,
  },
]

// 7-day deterministic shift schedule starting today.
function buildSeedShifts(staffList: StaffMember[]): ShiftSlot[] {
  const slots: ShiftSlot[] = []
  const positions: ShiftPosition[] = ['morning', 'afternoon', 'evening', 'off']
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(today)
    date.setDate(date.getDate() + dayOffset)
    const dateStr = date.toISOString().slice(0, 10)
    staffList.forEach((member, i) => {
      const pos = positions[(dayOffset + i) % positions.length]
      slots.push({ staffId: member.id, date: dateStr, position: pos })
    })
  }
  return slots
}

const seedPolicies: CancellationPolicy[] = [
  {
    id: 'cp-flexible',
    name: 'Flexible',
    free_cancel_hours: 48,
    refund_pct: 100,
    description: 'ยกเลิกฟรีภายใน 48 ชั่วโมงก่อนเช็คอิน คืนเงิน 100%',
  },
  {
    id: 'cp-moderate',
    name: 'Moderate',
    free_cancel_hours: 24,
    refund_pct: 50,
    description: 'ยกเลิกฟรีภายใน 24 ชั่วโมงก่อนเช็คอิน คืนเงิน 50%',
  },
  {
    id: 'cp-strict',
    name: 'Strict',
    free_cancel_hours: 0,
    refund_pct: 0,
    description: 'ไม่คืนเงินหากยกเลิก',
  },
]

// In-memory mutable copies so resolve/approve actions feel real during dev.
const state = {
  damageReports: [...typed.housekeepingOverview.damageReports],
  refundRequests: [...typed.bookingsOversight.refundRequests],
  promotions: [...seedPromotions],
  staff: [...seedStaff],
  shifts: buildSeedShifts(seedStaff),
  settings: { ...seedSettings },
  roomUnits: [...seedRoomUnits],
  seasonalRates: [...seedSeasonalRates],
  policies: [...seedPolicies],
}

export async function getManagerDashboardStats(): Promise<ManagerDashboardStats> {
  return typed.dashboard
}

export async function getHousekeepingOverview(): Promise<HousekeepingOverviewData> {
  return {
    ...typed.housekeepingOverview,
    damageReports: state.damageReports,
  }
}

export async function getBookingsOversight(): Promise<BookingsOversightData> {
  return {
    ...typed.bookingsOversight,
    refundRequests: state.refundRequests,
  }
}

export async function getReportsData(): Promise<ReportsData> {
  return typed.reports
}

export async function resolveDamageReport(args: {
  reportId: string
  costEstimate: number
  resolutionNote: string
  resolvedBy: string
}): Promise<DamageReport> {
  const idx = state.damageReports.findIndex((r) => r.id === args.reportId)
  if (idx === -1) throw new Error('Damage report not found')
  const updated: DamageReport = {
    ...state.damageReports[idx],
    resolved: true,
    costEstimate: args.costEstimate,
    resolutionNote: args.resolutionNote,
    resolvedBy: args.resolvedBy,
    resolvedAt: new Date().toISOString(),
  }
  state.damageReports[idx] = updated
  return updated
}

export async function approveRefund(args: { refundId: string }): Promise<{ id: string }> {
  state.refundRequests = state.refundRequests.filter((r) => r.id !== args.refundId)
  return { id: args.refundId }
}

export async function rejectRefund(args: { refundId: string; reason: string }): Promise<{ id: string }> {
  state.refundRequests = state.refundRequests.filter((r) => r.id !== args.refundId)
  return { id: args.refundId }
}

// =========================================================
// Getters
// =========================================================

export async function getHotelSettings(): Promise<HotelSettings> {
  return state.settings
}

export async function listPromotions(): Promise<Promotion[]> {
  return state.promotions
}

export async function getPromotionById(id: string): Promise<Promotion | null> {
  return state.promotions.find((p) => p.id === id) ?? null
}

export async function listStaff(): Promise<StaffMember[]> {
  return state.staff
}

export async function listShifts(): Promise<ShiftSlot[]> {
  return state.shifts
}

export async function listRoomUnits(): Promise<RoomUnitWithType[]> {
  return state.roomUnits
}

export async function listSeasonalRates(): Promise<SeasonalRate[]> {
  return state.seasonalRates
}

export async function listCancellationPolicies(): Promise<CancellationPolicy[]> {
  return state.policies
}

// =========================================================
// Mutations
// =========================================================

export async function setPromotionActive(args: { promotionId: string; isActive: boolean }): Promise<Promotion> {
  const idx = state.promotions.findIndex((p) => p.id === args.promotionId)
  if (idx === -1) throw new Error('Promotion not found')
  const updated: Promotion = {
    ...state.promotions[idx],
    is_active: args.isActive,
    updatedAt: new Date().toISOString(),
  }
  state.promotions[idx] = updated
  return updated
}

export async function createPromotion(args: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<Promotion> {
  const now = new Date().toISOString()
  const created: Promotion = {
    ...args,
    id: 'p-' + crypto.randomUUID().slice(0, 8),
    createdAt: now,
    updatedAt: now,
  }
  state.promotions.push(created)
  return created
}

export async function updatePromotion(args: {
  id: string
  patch: Partial<Omit<Promotion, 'id' | 'createdAt'>>
}): Promise<Promotion> {
  const idx = state.promotions.findIndex((p) => p.id === args.id)
  if (idx === -1) throw new Error('Promotion not found')
  const updated: Promotion = {
    ...state.promotions[idx],
    ...args.patch,
    updatedAt: new Date().toISOString(),
  }
  state.promotions[idx] = updated
  return updated
}

export async function deletePromotion(args: { id: string }): Promise<{ id: string }> {
  const idx = state.promotions.findIndex((p) => p.id === args.id)
  if (idx === -1) throw new Error('Promotion not found')
  state.promotions.splice(idx, 1)
  return { id: args.id }
}

export async function updateHotelSettings(args: Partial<HotelSettings>): Promise<HotelSettings> {
  state.settings = {
    ...state.settings,
    ...args,
    updated_at: new Date().toISOString(),
  }
  return state.settings
}

export async function closeRoomUnit(args: { unitId: string }): Promise<RoomUnitWithType> {
  const idx = state.roomUnits.findIndex((u) => u.id === args.unitId)
  if (idx === -1) throw new Error('Room unit not found')
  const updated: RoomUnitWithType = {
    ...state.roomUnits[idx],
    status: 'maintenance',
  }
  state.roomUnits[idx] = updated
  return updated
}

export async function reopenRoomUnit(args: { unitId: string }): Promise<RoomUnitWithType> {
  const idx = state.roomUnits.findIndex((u) => u.id === args.unitId)
  if (idx === -1) throw new Error('Room unit not found')
  const updated: RoomUnitWithType = {
    ...state.roomUnits[idx],
    status: 'available',
  }
  state.roomUnits[idx] = updated
  return updated
}

export async function setStaffActive(args: { staffId: string; isActive: boolean }): Promise<StaffMember> {
  const idx = state.staff.findIndex((s) => s.id === args.staffId)
  if (idx === -1) throw new Error('Staff member not found')
  const updated: StaffMember = {
    ...state.staff[idx],
    is_active: args.isActive,
  }
  state.staff[idx] = updated
  return updated
}

export async function createStaff(args: {
  full_name: string
  email: string
  role: StaffMember['role']
  phone: string | null
  password: string
}): Promise<{ staff: StaffMember; initialPassword: string }> {
  const id = 's-' + crypto.randomUUID().slice(0, 8)
  const created: StaffMember = {
    id,
    full_name: args.full_name,
    email: args.email,
    role: args.role,
    is_active: true,
    avatar_key: null,
    hired_at: new Date().toISOString().slice(0, 10),
    phone: args.phone,
  }
  state.staff.push(created)
  return { staff: created, initialPassword: args.password }
}

export async function updateStaff(args: {
  id: string
  patch: Partial<Pick<StaffMember, 'full_name' | 'phone' | 'role' | 'is_active'>>
}): Promise<StaffMember> {
  const idx = state.staff.findIndex((s) => s.id === args.id)
  if (idx === -1) throw new Error('Staff member not found')
  const updated: StaffMember = {
    ...state.staff[idx],
    ...args.patch,
  }
  state.staff[idx] = updated
  return updated
}

export async function countActiveAdmins(excludeId?: string): Promise<number> {
  return state.staff.filter(
    (s) => s.role === 'admin' && s.is_active && s.id !== excludeId,
  ).length
}

export async function createSeasonalRate(
  args: Omit<SeasonalRate, 'id' | 'room_type_name'>,
): Promise<SeasonalRate> {
  const id = 'sr-' + crypto.randomUUID().slice(0, 8)
  const roomType = await import('./mock-rooms').then((m) =>
    m.getRoomTypeById(args.room_type_id),
  )
  const created: SeasonalRate = {
    ...args,
    id,
    room_type_name: roomType?.name,
  }
  state.seasonalRates.push(created)
  return created
}

export async function updateSeasonalRate(args: {
  id: string
  patch: Partial<Omit<SeasonalRate, 'id' | 'room_type_name'>>
}): Promise<SeasonalRate> {
  const idx = state.seasonalRates.findIndex((r) => r.id === args.id)
  if (idx === -1) throw new Error('Seasonal rate not found')
  const updated: SeasonalRate = { ...state.seasonalRates[idx], ...args.patch }
  state.seasonalRates[idx] = updated
  return updated
}

export async function deleteSeasonalRate(args: { id: string }): Promise<{ id: string }> {
  const idx = state.seasonalRates.findIndex((r) => r.id === args.id)
  if (idx === -1) throw new Error('Seasonal rate not found')
  state.seasonalRates.splice(idx, 1)
  return { id: args.id }
}

/**
 * Pricing engine helper.
 * Returns active seasonal rates whose [start_date, end_date] (inclusive)
 * overlaps the booking window [checkIn, checkOut).
 */
export async function getActiveSeasonalRatesForRange(args: {
  roomTypeId: string
  checkIn: string
  checkOut: string
}): Promise<SeasonalRate[]> {
  return state.seasonalRates.filter(
    (r) =>
      r.room_type_id === args.roomTypeId &&
      r.is_active &&
      r.start_date <= args.checkOut &&
      r.end_date >= args.checkIn,
  )
}
