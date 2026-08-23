/**
 * Supabase implementation of Manager data layer.
 * Stubs return safe empty shapes; mutations throw "Phase 7".
 * Real queries will land in Phase 7 once the admin portal ships.
 */

import type {
  ManagerDashboardStats,
  HousekeepingOverviewData,
  BookingsOversightData,
  ReportsData,
  DamageReport,
  Promotion,
  StaffMember,
  ShiftSlot,
  HotelSettings,
  RoomUnitWithType,
  SeasonalRate,
  CancellationPolicy,
} from './types'

// TODO(phase-7): replace with real Supabase queries + RLS-enforced reads.

export async function getManagerDashboardStats(): Promise<ManagerDashboardStats> {
  return {
    revenueToday: 0,
    revenueTrendPct: 0,
    occupancyRatePct: 0,
    checkInsToday: 0,
    checkOutsToday: 0,
    newBookingsToday: 0,
    webBookings: 0,
    walkInBookings: 0,
    revenue7d: [],
    alerts: [],
  }
}

export async function getHousekeepingOverview(): Promise<HousekeepingOverviewData> {
  return {
    totalRooms: 0,
    dirtyCount: 0,
    cleaningCount: 0,
    inspectedCount: 0,
    floors: [],
    floorAssignments: [],
    unassignedTasks: [],
    damageReports: [],
  }
}

export async function getBookingsOversight(): Promise<BookingsOversightData> {
  return { activeCount: 0, bookings: [], refundRequests: [], auditLog: [] }
}

export async function getReportsData(): Promise<ReportsData> {
  return {
    totalRevenue7d: 0,
    totalRevenueTrendPct: 0,
    dailyRevenue: [],
    occupancyYoY: [],
    mostBookedRooms: [],
    highestRevenueRoomTypes: [],
    channels: [],
    totalBookings7d: 0,
    cancellationRatePct: 0,
    cancellationTrendPct: 0,
  }
}

export async function resolveDamageReport(_args: {
  reportId: string
  costEstimate: number
  resolutionNote: string
  resolvedBy: string
}): Promise<DamageReport> {
  throw new Error('resolveDamageReport not implemented in supabase-manager (Phase 7)')
}

export async function approveRefund(_args: { refundId: string }): Promise<{ id: string }> {
  throw new Error('approveRefund not implemented in supabase-manager (Phase 7)')
}

export async function rejectRefund(_args: { refundId: string; reason: string }): Promise<{ id: string }> {
  throw new Error('rejectRefund not implemented in supabase-manager (Phase 7)')
}

// =========================================================
// Phase 6 stubs
// =========================================================

export async function getHotelSettings(): Promise<HotelSettings> {
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

export async function listPromotions(): Promise<Promotion[]> {
  return []
}

export async function getPromotionById(_id: string): Promise<Promotion | null> {
  return null
}

export async function listStaff(): Promise<StaffMember[]> {
  return []
}

export async function listShifts(): Promise<ShiftSlot[]> {
  return []
}

export async function listRoomUnits(): Promise<RoomUnitWithType[]> {
  return []
}

export async function listSeasonalRates(): Promise<SeasonalRate[]> {
  return []
}

export async function listCancellationPolicies(): Promise<CancellationPolicy[]> {
  return [
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
}

export async function setPromotionActive(_args: { promotionId: string; isActive: boolean }): Promise<Promotion> {
  throw new Error('setPromotionActive not implemented in supabase-manager (Phase 7)')
}

export async function updateHotelSettings(_args: Partial<HotelSettings>): Promise<HotelSettings> {
  throw new Error('updateHotelSettings not implemented in supabase-manager (Phase 7)')
}

export async function closeRoomUnit(_args: { unitId: string }): Promise<RoomUnitWithType> {
  throw new Error('closeRoomUnit not implemented in supabase-manager (Phase 7)')
}

export async function reopenRoomUnit(_args: { unitId: string }): Promise<RoomUnitWithType> {
  throw new Error('reopenRoomUnit not implemented in supabase-manager (Phase 7)')
}

export async function setStaffActive(_args: { staffId: string; isActive: boolean }): Promise<StaffMember> {
  throw new Error('setStaffActive not implemented in supabase-manager (Phase 7)')
}
