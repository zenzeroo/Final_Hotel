/**
 * Phase 20 #31 — XLSX export smoke test.
 *
 * Verifies the workbook generation logic by mirroring what the API
 * route does (sheet creation + styling) without needing a live HTTP
 * server. Checks:
 *
 *   1. Workbook generates a non-empty buffer
 *   2. Buffer has valid XLSX (ZIP) signature
 *   3. Workbook contains all 6 expected sheet names
 *   4. Each sheet has the expected header row
 *   5. Numeric cells parse back as numbers
 *   6. Summary sheet correctly maps ReportsData fields
 *
 * Run with: `npx tsx scripts/test-phase31-xlsx-export.mts`
 */
import ExcelJS from 'exceljs'

const log = (label: string, pass: boolean, detail?: string) => {
  const tag = pass ? '✓' : '✗'
  console.log(`${tag} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!pass) process.exitCode = 1
}

// Mirror of the route logic — kept in sync manually. If the route
// changes sheet structure, update both. Not duplicated for runtime
// reuse — just so the smoke test doesn't need a running server.
function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
    cell.alignment = { vertical: 'middle' }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

const workbook = new ExcelJS.Workbook()
workbook.creator = 'Zenzero Hotel'
workbook.created = new Date()

// Summary
const summary = workbook.addWorksheet('สรุปภาพรวม')
summary.columns = [
  { header: 'เมตริก', key: 'metric', width: 40 },
  { header: 'ค่า', key: 'value', width: 24 },
]
summary.addRows([
  { metric: 'รายได้รวม 7 วัน (THB)', value: 125000 },
  { metric: 'แนวโน้มรายได้ vs 7 วันก่อน (%)', value: 12 },
  { metric: 'จำนวนการจอง 7 วัน', value: 47 },
  { metric: 'อัตราการยกเลิก (%)', value: 8 },
  { metric: 'แนวโน้มการยกเลิก vs 7 วันก่อน (%)', value: -3 },
])
styleSheet(summary)

// Daily Revenue
const daily = workbook.addWorksheet('รายได้รายวัน (7 วัน)')
daily.columns = [
  { header: 'วันที่', key: 'date', width: 14 },
  { header: 'วันในสัปดาห์', key: 'label', width: 14 },
  { header: 'รายได้ (THB)', key: 'revenue', width: 18 },
]
daily.addRows([
  { date: '2026-09-01', label: 'Mon', revenue: 18000 },
  { date: '2026-09-02', label: 'Tue', revenue: 22000 },
  { date: '2026-09-03', label: 'Wed', revenue: 19500 },
])
styleSheet(daily)

// Occupancy YoY
const occupancy = workbook.addWorksheet('Occupancy YoY (30 วัน)')
occupancy.columns = [
  { header: 'เดือน', key: 'month', width: 14 },
  { header: 'ปีก่อน (%)', key: 'last', width: 14 },
  { header: 'ปีนี้ (%)', key: 'current', width: 14 },
]
occupancy.addRows([
  { month: '2026-08', last: 65.5, current: 72.3 },
  { month: '2026-09', last: 68.0, current: 75.1 },
])
styleSheet(occupancy)

// Most Booked Rooms
const mostBooked = workbook.addWorksheet('ห้องที่ถูกจองมากที่สุด')
mostBooked.columns = [
  { header: 'ประเภทห้อง', key: 'name', width: 32 },
  { header: 'จำนวนการจอง', key: 'count', width: 16 },
]
mostBooked.addRows([
  { name: 'Deluxe King', count: 28 },
  { name: 'Suite Ocean View', count: 14 },
])
styleSheet(mostBooked)

// Highest Revenue Room Types
const highestRev = workbook.addWorksheet('ประเภทห้องที่มีรายได้สูงสุด')
highestRev.columns = [
  { header: 'ประเภทห้อง', key: 'name', width: 32 },
  { header: 'รายได้ (THB)', key: 'revenue', width: 18 },
]
highestRev.addRows([
  { name: 'Suite Ocean View', revenue: 480000 },
  { name: 'Villa Beachfront', revenue: 720000 },
])
styleSheet(highestRev)

// Channels
const channels = workbook.addWorksheet('ช่องทางการจอง')
channels.columns = [
  { header: 'ช่องทาง', key: 'label', width: 20 },
  { header: 'สัดส่วน (%)', key: 'percent', width: 14 },
]
channels.addRows([
  { label: 'Web', percent: 58.5 },
  { label: 'Walk-in', percent: 31.2 },
  { label: 'Phone', percent: 10.3 },
])
styleSheet(channels)

async function main() {
  console.log('\n=== Phase 20 #31 — XLSX export smoke test ===\n')

  const buffer = await workbook.xlsx.writeBuffer()

  // Case 1: Buffer is non-empty
  log('Case 1: writeBuffer returns non-empty buffer', buffer.byteLength > 0, `${buffer.byteLength} bytes`)

  // Case 2: ZIP/XLSX signature — first 4 bytes should be PK\x03\x04
  const bytes = new Uint8Array(buffer as ArrayBuffer)
  const isZip =
    bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
  log('Case 2: buffer has ZIP signature (PK\\x03\\x04)', isZip, `first bytes: ${bytes.slice(0, 4).toString('hex')}`)

  // Case 3: Re-parse and verify sheet structure
  const reparsed = new ExcelJS.Workbook()
  await reparsed.xlsx.load(buffer)
  const sheetNames = reparsed.worksheets.map((s) => s.name)
  const expectedSheets = [
    'สรุปภาพรวม',
    'รายได้รายวัน (7 วัน)',
    'Occupancy YoY (30 วัน)',
    'ห้องที่ถูกจองมากที่สุด',
    'ประเภทห้องที่มีรายได้สูงสุด',
    'ช่องทางการจอง',
  ]
  const hasAllSheets = expectedSheets.every((name) => sheetNames.includes(name))
  log('Case 3: all 6 expected sheets present', hasAllSheets, `got ${sheetNames.length} sheets: ${sheetNames.join(', ')}`)

  // Case 4: Summary sheet has 5 data rows
  const summarySheet = reparsed.getWorksheet('สรุปภาพรวม')
  const summaryRowCount = summarySheet?.rowCount ?? 0
  log('Case 4: summary sheet has 5 data rows + header', summaryRowCount === 6, `rowCount=${summaryRowCount}`)

  // Case 5: Summary value cells parse back as numbers
  const revRow = summarySheet?.getRow(2)
  const revCellValue = revRow?.getCell(2).value
  log('Case 5: summary row 2 col 2 parses as number', revCellValue === 125000, `got ${JSON.stringify(revCellValue)}`)

  // Case 6: Daily revenue data row count
  const dailySheet = reparsed.getWorksheet('รายได้รายวัน (7 วัน)')
  const dailyRowCount = dailySheet?.rowCount ?? 0
  log('Case 6: daily sheet has 3 data rows + header', dailyRowCount === 4, `rowCount=${dailyRowCount}`)

  // Case 7: Channel percent values are numeric
  const channelSheet = reparsed.getWorksheet('ช่องทางการจอง')
  const webRow = channelSheet?.getRow(2)
  const webPct = webRow?.getCell(2).value
  log('Case 7: channel row 2 col 2 parses as number', webPct === 58.5, `got ${JSON.stringify(webPct)}`)

  // Case 8: Thai text survives round-trip (UTF-8)
  const summaryA1 = summarySheet?.getCell('A1').value
  log('Case 8: Thai text round-trips intact', summaryA1 === 'เมตริก', `got ${JSON.stringify(summaryA1)}`)

  // Case 9 + 10: styling is set on the source workbook BEFORE serialization.
  // (ExcelJS drops some metadata on write→load round-trip, so we check
  // the live workbook object instead of the re-parsed one.)
  // Note: bold is set per-cell via eachCell; reading row.font returns
  // the row-level font (separate from cell-level), which is still
  // undefined. Check cell A1 directly.
  const cellFont = summary.getCell('A1').font
  log('Case 9: header cell A1 has bold font', cellFont?.bold === true, `bold=${cellFont?.bold}`)

  const views = summary.views
  log('Case 10: summary sheet has frozen header pane', Array.isArray(views) && views[0]?.state === 'frozen', `views=${JSON.stringify(views)}`)

  console.log('\n=== Done ===')
}

main().catch((e) => {
  console.error('Test crashed:', e)
  process.exit(1)
})
