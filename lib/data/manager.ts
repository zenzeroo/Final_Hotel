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

// Phase 7 — Admin CRUD
export const createPromotion = useMock ? mock.createPromotion : real.createPromotion
export const updatePromotion = useMock ? mock.updatePromotion : real.updatePromotion
export const deletePromotion = useMock ? mock.deletePromotion : real.deletePromotion
export const updateHotelSettings = useMock ? mock.updateHotelSettings : real.updateHotelSettings
export const closeRoomUnit = useMock ? mock.closeRoomUnit : real.closeRoomUnit
export const reopenRoomUnit = useMock ? mock.reopenRoomUnit : real.reopenRoomUnit
export const setStaffActive = useMock ? mock.setStaffActive : real.setStaffActive

// Phase 7 — Admin CRUD
export const createStaff = useMock ? mock.createStaff : real.createStaff
export const updateStaff = useMock ? mock.updateStaff : real.updateStaff
export const countActiveAdmins = useMock ? mock.countActiveAdmins : real.countActiveAdmins

// Phase 7 — Seasonal Rate CRUD
export const createSeasonalRate = useMock ? mock.createSeasonalRate : real.createSeasonalRate
export const updateSeasonalRate = useMock ? mock.updateSeasonalRate : real.updateSeasonalRate
export const deleteSeasonalRate = useMock ? mock.deleteSeasonalRate : real.deleteSeasonalRate

// Phase 8 — Pricing engine
export const getActiveSeasonalRatesForRange = useMock
  ? mock.getActiveSeasonalRatesForRange
  : real.getActiveSeasonalRatesForRange
