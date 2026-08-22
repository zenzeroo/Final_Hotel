import * as mock from './mock-manager'
import * as real from './supabase-manager'

const useMock = process.env.USE_MOCK_DATA === '1' || process.env.USE_MOCK_DATA === 'true'

export const getManagerDashboardStats = useMock ? mock.getManagerDashboardStats : real.getManagerDashboardStats
export const getHousekeepingOverview = useMock ? mock.getHousekeepingOverview : real.getHousekeepingOverview
export const getBookingsOversight = useMock ? mock.getBookingsOversight : real.getBookingsOversight
export const getReportsData = useMock ? mock.getReportsData : real.getReportsData
export const resolveDamageReport = useMock ? mock.resolveDamageReport : real.resolveDamageReport
export const approveRefund = useMock ? mock.approveRefund : real.approveRefund
export const rejectRefund = useMock ? mock.rejectRefund : real.rejectRefund
