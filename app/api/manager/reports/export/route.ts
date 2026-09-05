import ExcelJS from 'exceljs'
import { getSession } from '@/lib/supabase/getSession'
import { getReportsData } from '@/lib/data/manager'

/**
 * Phase 20 #31 — Excel export for the manager reports page.
 *
 * Mirrors the data shape used by /manager/reports (ReportsData from
 * lib/data/types.ts) but flattened into a workbook with 6 sheets so
 * the user can slice/dice offline.
 *
 * Auth: requires an authenticated user with role ∈ {manager, admin}.
 * Reception + housekeeper + user → 403. Unauthenticated → 401.
 * (Stripe webhook uses HMAC instead of session; here we DO need a
 * session because the report is user-scoped.)
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (session.role !== 'manager' && session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const data = await getReportsData()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Zenzero Hotel'
  workbook.created = new Date()

  // ---------- Summary ----------
  const summary = workbook.addWorksheet('สรุปภาพรวม')
  summary.columns = [
    { header: 'เมตริก', key: 'metric', width: 40 },
    { header: 'ค่า', key: 'value', width: 24 },
  ]
  summary.addRows([
    { metric: 'รายได้รวม 7 วัน (THB)', value: data.totalRevenue7d },
    {
      metric: 'แนวโน้มรายได้ vs 7 วันก่อน (%)',
      value: data.totalRevenueTrendPct,
    },
    { metric: 'จำนวนการจอง 7 วัน', value: data.totalBookings7d },
    { metric: 'อัตราการยกเลิก (%)', value: data.cancellationRatePct },
    {
      metric: 'แนวโน้มการยกเลิก vs 7 วันก่อน (%)',
      value: data.cancellationTrendPct,
    },
  ])
  styleSheet(summary)
  styleMoneyColumn(summary, 1, 'value')

  // ---------- Daily Revenue ----------
  const daily = workbook.addWorksheet('รายได้รายวัน (7 วัน)')
  daily.columns = [
    { header: 'วันที่', key: 'date', width: 14 },
    { header: 'วันในสัปดาห์', key: 'label', width: 14 },
    { header: 'รายได้ (THB)', key: 'revenue', width: 18 },
  ]
  daily.addRows(data.dailyRevenue.map((p) => ({
    date: p.date,
    label: p.label ?? '',
    revenue: p.revenue,
  })))
  styleSheet(daily)
  styleMoneyColumn(daily, 2, 'revenue')

  // ---------- Occupancy YoY ----------
  const occupancy = workbook.addWorksheet('Occupancy YoY (30 วัน)')
  occupancy.columns = [
    { header: 'เดือน', key: 'month', width: 14 },
    { header: 'ปีก่อน (%)', key: 'last', width: 14 },
    { header: 'ปีนี้ (%)', key: 'current', width: 14 },
  ]
  // Empty branch — add placeholder row when getReportsData returns []
  if (data.occupancyYoY.length === 0) {
    occupancy.addRow({ month: 'ไม่มีข้อมูล (ต้องมีการจองอย่างน้อย 1 ปี)', last: '', current: '' })
  } else {
    occupancy.addRows(data.occupancyYoY)
  }
  styleSheet(occupancy)
  // Percent columns: format with %
  occupancy.getColumn('last').numFmt = '0.0"%"'
  occupancy.getColumn('current').numFmt = '0.0"%"'

  // ---------- Most Booked Rooms ----------
  const mostBooked = workbook.addWorksheet('ห้องที่ถูกจองมากที่สุด')
  mostBooked.columns = [
    { header: 'ประเภทห้อง', key: 'name', width: 32 },
    { header: 'จำนวนการจอง', key: 'count', width: 16 },
  ]
  // Empty branch — placeholder when no bookings in window
  if (data.mostBookedRooms.length === 0) {
    mostBooked.addRow({ name: 'ไม่มีข้อมูล (ต้องมีการจองอย่างน้อย 1 รายการ)', count: '' })
  } else {
    mostBooked.addRows(data.mostBookedRooms)
  }
  styleSheet(mostBooked)

  // ---------- Highest Revenue Room Types ----------
  const highestRev = workbook.addWorksheet('ประเภทห้องที่มีรายได้สูงสุด')
  highestRev.columns = [
    { header: 'ประเภทห้อง', key: 'name', width: 32 },
    { header: 'รายได้ (THB)', key: 'revenue', width: 18 },
  ]
  // Empty branch — placeholder when no bookings in window
  if (data.highestRevenueRoomTypes.length === 0) {
    highestRev.addRow({ name: 'ไม่มีข้อมูล (ต้องมีการจองอย่างน้อย 1 รายการ)', revenue: '' })
  } else {
    highestRev.addRows(data.highestRevenueRoomTypes)
  }
  styleSheet(highestRev)
  styleMoneyColumn(highestRev, 1, 'revenue')

  // ---------- Channels ----------
  const channels = workbook.addWorksheet('ช่องทางการจอง')
  channels.columns = [
    { header: 'ช่องทาง', key: 'label', width: 20 },
    { header: 'สัดส่วน (%)', key: 'percent', width: 14 },
  ]
  // Empty branch — placeholder when no bookings in window
  if (data.channels.length === 0) {
    channels.addRow({ label: 'ไม่มีข้อมูล (ต้องมีการจองอย่างน้อย 1 รายการ)', percent: '' })
  } else {
    channels.addRows(data.channels)
  }
  styleSheet(channels)
  channels.getColumn('percent').numFmt = '0.0"%"'

  // ---------- Serialize ----------
  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `zenzero-reports-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Bold the header row + freeze it. */
function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
    cell.alignment = { vertical: 'middle' }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

/**
 * Format a numeric column as THB currency (no decimals, thousand separator).
 * `columnIndex` is 0-based (ExcelJS convention).
 */
function styleMoneyColumn(
  sheet: ExcelJS.Worksheet,
  columnIndex: number,
  key: string,
) {
  sheet.getColumn(key).numFmt = '#,##0'
  // Lightly right-align for readability.
  sheet.getColumn(columnIndex).alignment = { horizontal: 'right' }
}
