import * as mock from './mock-housekeeper'
import * as real from './supabase-housekeeper'

const useMock = process.env.USE_MOCK_DATA === '1' || process.env.USE_MOCK_DATA === 'true'

export const getMyTasksForUser = useMock ? mock.getMyTasksForUser : real.getMyTasksForUser
export const getUnassignedTasks = useMock ? mock.getUnassignedTasks : real.getUnassignedTasks
export const getMaintenanceReports = useMock ? mock.getMaintenanceReports : real.getMaintenanceReports
export const getMyDashboardStatsForUser = useMock ? mock.getMyDashboardStatsForUser : real.getMyDashboardStatsForUser
export const getAllRoomUnits = useMock ? mock.getAllRoomUnits : real.getAllRoomUnits
export const getMyWorkHistoryForUser = useMock ? mock.getMyWorkHistoryForUser : real.getMyWorkHistoryForUser
export const getAllWorkHistory = useMock ? mock.getAllWorkHistory : real.getAllWorkHistory