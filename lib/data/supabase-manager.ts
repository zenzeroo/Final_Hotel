/**
 * Supabase implementation of Manager data layer.
 * Stub — Phase 1 uses mock data. Real queries will land in Phase 2
 * once the manager role is promoted and we have real data to read.
 */

import type {
  ManagerDashboardStats,
  HousekeepingOverviewData,
  BookingsOversightData,
  ReportsData,
  DamageReport,
} from './types'

// TODO(phase-2): replace with real Supabase queries + RLS-enforced reads.

export async function getManagerDashboardStats(): Promise<ManagerDashboardStats> {
  // Stub: return minimal shape so dispatcher types check.
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
  throw new Error('resolveDamageReport not implemented in supabase-manager (Phase 2)')
}

export async function approveRefund(_args: { refundId: string }): Promise<{ id: string }> {
  throw new Error('approveRefund not implemented in supabase-manager (Phase 2)')
}

export async function rejectRefund(_args: { refundId: string; reason: string }): Promise<{ id: string }> {
  throw new Error('rejectRefund not implemented in supabase-manager (Phase 2)')
}
