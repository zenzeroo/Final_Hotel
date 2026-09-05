import ExcelJS from 'exceljs'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/supabase/getSession'
import { getReportsData } from '@/lib/data/manager'
import { LOCALE_COOKIE, toLocale, type Locale } from '@/lib/i18n/config'

/**
 * Phase 20 #31 — Excel export for the manager reports page.
 *
 * Phase 26 — column headers + sheet names are localized via the
 * `xlsx.*` dictionary keys (server-side EN/TH parallel labels).
 *
 * Auth: requires an authenticated user with role ∈ {manager, admin}.
 * Reception + housekeeper + user → 403. Unauthenticated → 401.
 */
export const dynamic = 'force-dynamic'

const XLSX_LABELS: Record<Locale, Record<string, string>> = {
  th: {
    summary: 'สรุปภาพรวม',
    metric: 'เมตริก',
    value: 'ค่า',
    totalRevenue7d: 'รายได้รวม 7 วัน (THB)',
    revenueTrend: 'แนวโน้มรายได้ vs 7 วันก่อน (%)',
    totalBookings7d: 'จำนวนการจอง 7 วัน',
    cancellationRate: 'อัตราการยกเลิก (%)',
    cancellationTrend: 'แนวโน้มการยกเลิก vs 7 วันก่อน (%)',
    dailyRevenue: 'รายได้รายวัน (7 วัน)',
    date: 'วันที่',
    weekday: 'วันในสัปดาห์',
    revenue: 'รายได้ (THB)',
    occupancyYoY: 'Occupancy YoY (30 วัน)',
    month: 'เดือน',
    lastYear: 'ปีก่อน (%)',
    thisYear: 'ปีนี้ (%)',
    mostBookedRooms: 'ห้องที่ถูกจองมากที่สุด',
    roomType: 'ประเภทห้อง',
    bookingCount: 'จำนวนการจอง',
    highestRevenueRoomTypes: 'ประเภทห้องที่มีรายได้สูงสุด',
    bookingChannels: 'ช่องทางการจอง',
    channel: 'ช่องทาง',
    percent: 'สัดส่วน (%)',
    noData: 'ไม่มีข้อมูล',
    noDataBookings: 'ต้องมีการจองอย่างน้อย 1 รายการ',
    noDataYear: 'ต้องมีการจองอย่างน้อย 1 ปี',
  },
  en: {
    summary: 'Summary',
    metric: 'Metric',
    value: 'Value',
    totalRevenue7d: 'Total Revenue 7d (THB)',
    revenueTrend: 'Revenue Trend vs prev 7d (%)',
    totalBookings7d: 'Bookings (7d)',
    cancellationRate: 'Cancellation Rate (%)',
    cancellationTrend: 'Cancellation Trend vs prev 7d (%)',
    dailyRevenue: 'Daily Revenue (7d)',
    date: 'Date',
    weekday: 'Weekday',
    revenue: 'Revenue (THB)',
    occupancyYoY: 'Occupancy YoY (30d)',
    month: 'Month',
    lastYear: 'Last Year (%)',
    thisYear: 'This Year (%)',
    mostBookedRooms: 'Most Booked Rooms',
    roomType: 'Room Type',
    bookingCount: 'Bookings',
    highestRevenueRoomTypes: 'Highest Revenue Room Types',
    bookingChannels: 'Booking Channels',
    channel: 'Channel',
    percent: 'Percent (%)',
    noData: 'No data',
    noDataBookings: 'requires at least 1 booking',
    noDataYear: 'requires at least 1 year of bookings',
  },
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (session.role !== 'manager' && session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const cookieStore = await cookies()
  const locale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value)
  const L = XLSX_LABELS[locale]

  const data = await getReportsData()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Zenzero Hotel'
  workbook.created = new Date()

  // ---------- Summary ----------
  const summary = workbook.addWorksheet(L.summary)
  summary.columns = [
    { header: L.metric, key: 'metric', width: 40 },
    { header: L.value, key: 'value', width: 24 },
  ]
  summary.addRows([
    { metric: L.totalRevenue7d, value: data.totalRevenue7d },
    { metric: L.revenueTrend, value: data.totalRevenueTrendPct },
    { metric: L.totalBookings7d, value: data.totalBookings7d },
    { metric: L.cancellationRate, value: data.cancellationRatePct },
    { metric: L.cancellationTrend, value: data.cancellationTrendPct },
  ])
  styleSheet(summary)
  styleMoneyColumn(summary, 1, 'value')

  // ---------- Daily Revenue ----------
  const daily = workbook.addWorksheet(L.dailyRevenue)
  daily.columns = [
    { header: L.date, key: 'date', width: 14 },
    { header: L.weekday, key: 'label', width: 14 },
    { header: L.revenue, key: 'revenue', width: 18 },
  ]
  daily.addRows(data.dailyRevenue.map((p) => ({
    date: p.date,
    label: p.label ?? '',
    revenue: p.revenue,
  })))
  styleSheet(daily)
  styleMoneyColumn(daily, 2, 'revenue')

  // ---------- Occupancy YoY ----------
  const occupancy = workbook.addWorksheet(L.occupancyYoY)
  occupancy.columns = [
    { header: L.month, key: 'month', width: 14 },
    { header: L.lastYear, key: 'last', width: 14 },
    { header: L.thisYear, key: 'current', width: 14 },
  ]
  if (data.occupancyYoY.length === 0) {
    occupancy.addRow({
      month: `${L.noData} (${L.noDataYear})`,
      last: '',
      current: '',
    })
  } else {
    occupancy.addRows(data.occupancyYoY)
  }
  styleSheet(occupancy)
  occupancy.getColumn('last').numFmt = '0.0"%"'
  occupancy.getColumn('current').numFmt = '0.0"%"'

  // ---------- Most Booked Rooms ----------
  const mostBooked = workbook.addWorksheet(L.mostBookedRooms)
  mostBooked.columns = [
    { header: L.roomType, key: 'name', width: 32 },
    { header: L.bookingCount, key: 'count', width: 16 },
  ]
  if (data.mostBookedRooms.length === 0) {
    mostBooked.addRow({ name: `${L.noData} (${L.noDataBookings})`, count: '' })
  } else {
    mostBooked.addRows(data.mostBookedRooms)
  }
  styleSheet(mostBooked)

  // ---------- Highest Revenue Room Types ----------
  const highestRev = workbook.addWorksheet(L.highestRevenueRoomTypes)
  highestRev.columns = [
    { header: L.roomType, key: 'name', width: 32 },
    { header: L.revenue, key: 'revenue', width: 18 },
  ]
  if (data.highestRevenueRoomTypes.length === 0) {
    highestRev.addRow({ name: `${L.noData} (${L.noDataBookings})`, revenue: '' })
  } else {
    highestRev.addRows(data.highestRevenueRoomTypes)
  }
  styleSheet(highestRev)
  styleMoneyColumn(highestRev, 1, 'revenue')

  // ---------- Channels ----------
  const channels = workbook.addWorksheet(L.bookingChannels)
  channels.columns = [
    { header: L.channel, key: 'label', width: 20 },
    { header: L.percent, key: 'percent', width: 14 },
  ]
  if (data.channels.length === 0) {
    channels.addRow({ label: `${L.noData} (${L.noDataBookings})`, percent: '' })
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

function styleMoneyColumn(
  sheet: ExcelJS.Worksheet,
  columnIndex: number,
  key: string,
) {
  sheet.getColumn(key).numFmt = '#,##0'
  sheet.getColumn(columnIndex).alignment = { horizontal: 'right' }
}
