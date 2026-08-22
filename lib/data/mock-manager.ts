import type {
  ManagerDashboardStats,
  HousekeepingOverviewData,
  BookingsOversightData,
  ReportsData,
  DamageReport,
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

// In-memory mutable copies so resolve/approve actions feel real during dev.
const state = {
  damageReports: [...typed.housekeepingOverview.damageReports],
  refundRequests: [...typed.bookingsOversight.refundRequests],
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
