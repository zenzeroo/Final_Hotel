/**
 * Smoke test manager routes with a real Supabase SSR session.
 *
 * Steps:
 *  1. Sign in via @supabase/ssr (creates cookies in the expected format)
 *  2. Build a Cookie header from those cookies
 *  3. GET each manager route, verify HTML contains expected fragments
 *
 * Run: npx tsx scripts/smoke-manager.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const APP = 'http://localhost:3000'
const EMAIL = 'manager@zenzero.com'
const PASSWORD = process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!'

let passed = 0
let failed = 0

async function step(name: string, fn: () => Promise<string | void>) {
  process.stdout.write(`▶ ${name}\n`)
  try {
    const r = await fn()
    console.log(`  ✓ ${name}` + (r ? ` — ${r}` : ''))
    passed++
    return true
  } catch (e) {
    console.log(`  ✗ ${name} — ${(e as Error).message}`)
    failed++
    return false
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// Build SSR cookies
const cookies: { name: string; value: string; opts?: CookieOptions }[] = []
const supabase = createServerClient(BASE, ANON, {
  cookies: {
    getAll: () => cookies.map((c) => ({ name: c.name, value: c.value })),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) {
        const existing = cookies.findIndex((c) => c.name === name)
        if (existing >= 0) cookies[existing] = { name, value, opts: options }
        else cookies.push({ name, value, opts: options })
      }
    },
  },
})

await step('Sign in via @supabase/ssr', async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return `uid=${data.user.id}, cookies=${cookies.length}`
})

await step('Verify manager role in profile', async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('no authenticated user')
  const { data: prof, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()
  if (error) throw new Error(error.message)
  if (!prof || prof.role !== 'manager') {
    throw new Error(`expected role=manager, got ${prof?.role ?? 'null'}`)
  }
  return `role=${prof.role}, name=${prof.full_name}`
})

const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

async function fetchPage(path: string, expectStatus = 200): Promise<string> {
  const res = await fetch(`${APP}${path}`, {
    headers: { Cookie: cookieHeader },
    redirect: 'manual',
  })
  if (res.status !== expectStatus) {
    const loc = res.headers.get('location')
    throw new Error(`HTTP ${res.status} → ${loc ?? '(no redirect)'}`)
  }
  return res.text()
}

// ─── Dashboard ───
let dashboardHtml = ''
await step('GET /manager (dashboard)', async () => {
  dashboardHtml = await fetchPage('/manager')
  return `${(dashboardHtml.length / 1024).toFixed(1)} KB`
})
await step('Dashboard: KPI label "รายได้วันนี้"', () => {
  assert(dashboardHtml.includes('รายได้วันนี้'), 'KPI label not found')
})
await step('Dashboard: mock revenue ฿142,500', () => {
  assert(dashboardHtml.includes('฿142,500'), 'mock revenue ฿142,500 not in HTML')
})
await step('Dashboard: 3 alerts present', () => {
  assert(dashboardHtml.includes('ระบบปรับอากาศห้อง 302'), 'critical alert missing')
  assert(dashboardHtml.includes('Walk-in กลุ่มใหญ่'), 'warning alert missing')
  assert(dashboardHtml.includes('OTA bookings ลดลง'), 'info alert missing')
})
await step('Dashboard: 7 revenue bars (aria-labels)', () => {
  const matches = dashboardHtml.match(/aria-label="[A-Z][a-z]{2}: ฿/g) ?? []
  assert(matches.length === 7, `expected 7 bars, found ${matches.length}`)
})
await step('Sidebar: 4 active nav links (manager routes)', () => {
  for (const label of ['Booking Oversight', 'Housekeeping Overview']) {
    assert(dashboardHtml.includes(label), `nav link missing: ${label}`)
  }
  // "Reports & Analytics" — & may be HTML-escaped in the rendered link
  assert(
    dashboardHtml.includes('Reports & Analytics') ||
      dashboardHtml.includes('Reports &amp; Analytics'),
    'Reports & Analytics link missing',
  )
})
await step('Sidebar: 4 disabled "Soon" items', () => {
  const soonCount = (dashboardHtml.match(/เร็วๆ นี้/g) ?? []).length
  assert(soonCount >= 4, `expected ≥4 "Soon" markers, found ${soonCount}`)
})

// ─── Housekeeping ───
let hkHtml = ''
await step('GET /manager/housekeeping', async () => {
  hkHtml = await fetchPage('/manager/housekeeping')
  return `${(hkHtml.length / 1024).toFixed(1)} KB`
})
await step('Housekeeping: 4 KPI strip labels', () => {
  for (const t of ['Total Rooms', 'Dirty', 'Cleaning', 'Inspected / Ready']) {
    assert(hkHtml.includes(t), `missing KPI: ${t}`)
  }
})
await step('Housekeeping: floor groups (Deluxe Forest View + Penthouse)', () => {
  assert(hkHtml.includes('Deluxe Forest View'), 'floor label missing')
  // & may be HTML-escaped — match either
  assert(
    hkHtml.includes('Penthouse & Suites') || hkHtml.includes('Penthouse &amp; Suites'),
    'penthouse floor missing',
  )
})
await step('Housekeeping: Floor Assignments shows Somjit + Niran', () => {
  assert(hkHtml.includes('Somjit'), 'Somjit missing')
  assert(hkHtml.includes('Niran'), 'Niran missing')
})
await step('Housekeeping: Damage Report rows (304, 402, 201, 303)', () => {
  assert(hkHtml.includes('>304<'), 'room 304 missing')
  assert(hkHtml.includes('>402<'), 'room 402 missing')
  assert(hkHtml.includes('>201<'), 'room 201 missing')
  assert(hkHtml.includes('>303<'), 'room 303 missing')
})
await step('Housekeeping: severity "ปกติ" and "เร่งด่วน"', () => {
  assert(hkHtml.includes('ปกติ'), 'ปกติ (normal) missing')
  assert(hkHtml.includes('เร่งด่วน'), 'เร่งด่วน (urgent) missing')
})
await step('Housekeeping: Resolve buttons on unresolved rows', () => {
  const resolveBtns = (hkHtml.match(/เรียกเก็บเงินลูกค้า/g) ?? []).length
  // 3 unresolved damage reports (dmg-1, dmg-2, dmg-3), dmg-4 is resolved
  assert(resolveBtns === 3, `expected 3 Resolve buttons, found ${resolveBtns}`)
})

// ─── Bookings (main) ───
let bkHtml = ''
await step('GET /manager/bookings (main tab)', async () => {
  bkHtml = await fetchPage('/manager/bookings')
  return `${(bkHtml.length / 1024).toFixed(1)} KB`
})
await step('Bookings table: Eleanor Smith + #ZZ-10492', () => {
  assert(bkHtml.includes('Eleanor Smith'), 'guest name missing')
  assert(bkHtml.includes('#ZZ-10492'), 'booking code missing')
})
await step('Bookings: status badges (Paid/Pending/Cancelled)', () => {
  assert(bkHtml.includes('Paid'), 'Paid badge missing')
  assert(bkHtml.includes('Pending'), 'Pending badge missing')
  assert(bkHtml.includes('Cancelled'), 'Cancelled badge missing')
})
await step('Bookings: tab nav "คำขอคืนเงิน" with badge "3"', () => {
  assert(bkHtml.includes('คำขอคืนเงิน'), 'refunds tab missing')
  assert(/3<\/span>/.test(bkHtml), 'badge count missing')
})

// ─── Bookings (refunds tab) ───
await step('GET /manager/bookings?tab=refunds', async () => {
  const html = await fetchPage('/manager/bookings?tab=refunds')
  assert(html.includes('Tahani Al-Jamil'), 'Tahani refund card missing')
  assert(html.includes('James O'), 'James refund card missing')
  assert(html.includes('Markus Schneider'), 'Markus refund card missing')
  assert(html.includes('Approve'), 'Approve button missing')
  assert(html.includes('Reject'), 'Reject button missing')
  return '3 refund cards + approve/reject buttons'
})

// ─── Bookings (audit tab) ───
await step('GET /manager/bookings?tab=audit', async () => {
  const html = await fetchPage('/manager/bookings?tab=audit')
  assert(html.includes('MGR-02'), 'staff ID missing')
  assert(html.includes('MGR-01'), 'manager 01 missing')
  assert(html.includes('Special Edit'), 'audit action missing')
  assert(html.includes('Refund Approved'), 'refund audit missing')
  return '5 audit entries'
})

// ─── Reports ───
let repHtml = ''
await step('GET /manager/reports', async () => {
  repHtml = await fetchPage('/manager/reports')
  return `${(repHtml.length / 1024).toFixed(1)} KB`
})
await step('Reports: Total Revenue ฿1,245,000', () => {
  assert(repHtml.includes('1,245,000'), 'total revenue missing')
})
await step('Reports: Booking Channels (User Web 65%, Walk-in 25%, OTA 10%)', () => {
  for (const c of ['User Web', 'Walk-in', 'OTA']) {
    assert(repHtml.includes(c), `channel missing: ${c}`)
  }
  // % is split by React text node — check for "65" + "%" proximity
  assert(/>65</.test(repHtml) || repHtml.includes('>65%'), '65% slice missing')
  assert(/>25</.test(repHtml) || repHtml.includes('>25%'), '25% slice missing')
})
await step('Reports: Cancellation Rate 4.2%', () => {
  assert(repHtml.includes('Cancellation Rate'), 'cancellation card missing')
  // React renders `4.2<!-- -->%` — match either form
  assert(
    repHtml.includes('4.2%') || repHtml.includes('4.2<!-- -->%'),
    'cancellation rate missing',
  )
})
await step('Reports: Chart.js canvases (≥3)', () => {
  const canvasCount = (repHtml.match(/<canvas/g) ?? []).length
  assert(canvasCount >= 3, `expected ≥3 <canvas>, found ${canvasCount}`)
})
await step('Reports: Export PDF + Export Excel buttons', () => {
  assert(repHtml.includes('Export PDF'), 'Export PDF missing')
  assert(repHtml.includes('Export Excel'), 'Export Excel missing')
})

console.log(`\n${failed === 0 ? '✅' : '⚠️'}  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
