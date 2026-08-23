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

// Phase 6 — Settings, Promotions, Staff, Rates
export const getHotelSettings = useMock ? mock.getHotelSettings : real.getHotelSettings
export const listPromotions = useMock ? mock.listPromotions : real.listPromotions
export const getPromotionById = useMock ? mock.getPromotionById : real.getPromotionById
export const listStaff = useMock ? mock.listStaff : real.listStaff
export const listShifts = useMock ? mock.listShifts : real.listShifts
export const listRoomUnits = useMock ? mock.listRoomUnits : real.listRoomUnits
export const listSeasonalRates = useMock ? mock.listSeasonalRates : real.listSeasonalRates
export const listCancellationPolicies = useMock ? mock.listCancellationPolicies : real.listCancellationPolicies
export const setPromotionActive = useMock ? mock.setPromotionActive : real.setPromotionActive
export const updateHotelSettings = useMock ? mock.updateHotelSettings : real.updateHotelSettings
export const closeRoomUnit = useMock ? mock.closeRoomUnit : real.closeRoomUnit
export const reopenRoomUnit = useMock ? mock.reopenRoomUnit : real.reopenRoomUnit
export const setStaffActive = useMock ? mock.setStaffActive : real.setStaffActive
