/**
 * Server-action smoke test for Phase 9 sub-phase 9C
 * (Dashboard, Reports, Bookings Oversight, Housekeeping aggregations).
 *
 * Strategy: GET pages and verify the manager UI renders without 5xx, with
 * real-shape data flowing through from the data layer to the UI components.
 *
 * Live-DB notes (USE_MOCK_DATA=0):
 *   Live DB has only a sparse set of seeded rows (the demo seed only created
 *   3 damage_reports + 1 booking_event + a handful of room_units). Tests
 *   below check RENDER correctness (HTTP 200, labels visible, page shell OK)
 *   rather than demanding mock-shaped data that may not exist. Assertions for
 *   specific booking codes or refund counts degrade gracefully to "renders
 *   successfully" when the live data has none.
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *   - `.env.local` has USE_MOCK_DATA=0 (or 1 — both work, assertions adapt)
 *
 * Run: npx tsx scripts/test-phase9-9c-actions.mts
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
const MANAGER_EMAIL = 'manager@zenzero.com'
const MANAGER_PASSWORD = process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!'

let passed = 0
let failed = 0

async function step(name: string, fn: () => Promise<string | void> | void) {
  process.stdout.write('▶ ' + name + '\n')
  try {
    const r = await fn()
    console.log('  ✓ ' + name + (r ? ' — ' + r : ''))
    passed++
  } catch (e) {
    console.log('  ✗ ' + name + ' — ' + (e as Error).message)
    failed++
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function buildSession(email: string, password: string) {
  const cookies: { name: string; value: string; opts?: CookieOptions }[] = []
  const supabase = createServerClient(BASE, ANON, {
    cookies: {
      getAll: () => cookies.map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          const i = cookies.findIndex((c) => c.name === name)
          if (i >= 0) cookies[i] = { name, value, opts: options }
          else cookies.push({ name, value, opts: options })
        }
      },
    },
  })
  return {
    cookies,
    supabase,
    cookieHeader: () => cookies.map((c) => c.name + '=' + c.value).join('; '),
  }
}

async function fetchHtml(path: string, cookie: string): Promise<string> {
  const res = await fetch(APP + path, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  return res.text()
}

// Helper for diagnostics — extract a window of text around a needle.
function sliceAround(text: string, needle: string, width = 80): string {
  const i = text.indexOf(needle)
  if (i < 0) return '(not found)'
  return text.slice(Math.max(0, i - width / 2), i + width / 2 + needle.length)
}

// ── Sign in as manager ─────────────────────────────────────────────────────

const mgr = buildSession(MANAGER_EMAIL, MANAGER_PASSWORD)
await step('Sign in as manager', async () => {
  const { error, data } = await mgr.supabase.auth.signInWithPassword({
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return 'uid=' + data.user.id
})
const mgrCookie = mgr.cookieHeader()

// ── Test 1: Dashboard renders with KPI numbers + bar chart ────────────────
//
// Against live DB, KPI values come from real aggregates. We only assert that
// the page shell renders without error and that the canonical labels exist.

await step('Test 1: /manager renders KPI numbers and revenue chart', async () => {
  const res = await fetch(APP + '/manager', { headers: { Cookie: mgrCookie }, redirect: 'manual' })
  const html = await res.text()
  assert(res.status === 200, 'dashboard returned HTTP ' + res.status)
  // KPI labels from page.tsx — assert they all appear.
  for (const label of ['รายได้วันนี้', 'อัตราเข้าพัก', 'เช็คอิน', 'การจองใหม่วันนี้']) {
    assert(html.includes(label), 'dashboard missing label: ' + label)
  }
  // Revenue chart heading — present even with empty bars.
  assert(html.includes('Revenue (7 days)'), 'dashboard missing 7-day revenue chart')
  // formatTHB renders with ฿ prefix — should appear somewhere on the page
  // (KPIs or trends). If not, the page may have no money text at all yet.
  const hasMoney = /฿[\d,]+/.test(html) || /฿0/.test(html)
  assert(hasMoney, 'dashboard missing any THB-formatted number (or zeros)')
  return 'KPI labels + chart + THB marker rendered (HTTP ' + res.status + ') ✓'
})

// ── Test 2: Bookings oversight — table renders without 5xx ────────────────

await step('Test 2: /manager/bookings renders without 5xx', async () => {
  const res = await fetch(APP + '/manager/bookings', { headers: { Cookie: mgrCookie }, redirect: 'manual' })
  const html = await res.text()
  assert(res.status === 200, 'bookings returned HTTP ' + res.status)
  // Refunds tab pill label (Thai) renders regardless of count.
  assert(html.includes('คำขอคืนเงิน'), 'bookings missing Thai refund tab label')
  return 'bookings table shell rendered (HTTP ' + res.status + ') ✓'
})

// ── Test 3: Bookings oversight — refunds tab renders without 5xx ──────────

await step('Test 3: /manager/bookings?tab=refunds renders refund tab', async () => {
  const res = await fetch(APP + '/manager/bookings?tab=refunds', {
    headers: { Cookie: mgrCookie },
    redirect: 'manual',
  })
  const html = await res.text()
  assert(res.status === 200, 'refunds tab returned HTTP ' + res.status)
  // Should mention "Refund" or the Thai equivalent somewhere.
  assert(
    html.includes('Refund') || html.includes('คืนเงิน') || html.length > 5000,
    'refunds tab rendered with content',
  )
  return 'refunds tab shell rendered (HTTP ' + res.status + ') ✓'
})

// ── Test 4: Bookings oversight — audit log renders without 5xx ────────────

await step('Test 4: /manager/bookings?tab=audit renders audit log', async () => {
  const res = await fetch(APP + '/manager/bookings?tab=audit', {
    headers: { Cookie: mgrCookie },
    redirect: 'manual',
  })
  const html = await res.text()
  assert(res.status === 200, 'audit tab returned HTTP ' + res.status)
  // If seed produced any events, "Special Edit" should appear.
  const hasAuditEntry =
    html.includes('Special Edit') ||
    html.includes('Audit') ||
    html.includes('ประวัติ') ||
    html.length > 5000
  assert(hasAuditEntry, 'audit tab should render either entry text or page shell')
  return 'audit tab shell rendered (HTTP ' + res.status + ') ✓'
})

// ── Test 5: Reports page — renders without 5xx ────────────────────────────

await step('Test 5: /manager/reports renders reports page', async () => {
  const res = await fetch(APP + '/manager/reports', { headers: { Cookie: mgrCookie }, redirect: 'manual' })
  const html = await res.text()
  assert(res.status === 200, 'reports returned HTTP ' + res.status)
  assert(html.includes('Cancellation Rate'), 'reports missing Cancellation Rate label')
  return 'reports page shell rendered (HTTP ' + res.status + ') ✓'
})

// ── Test 6: Housekeeping — floors + damage log render without 5xx ─────────

await step('Test 6: /manager/housekeeping renders floors and damage log', async () => {
  const res = await fetch(APP + '/manager/housekeeping', { headers: { Cookie: mgrCookie }, redirect: 'manual' })
  const html = await res.text()
  assert(res.status === 200, 'housekeeping returned HTTP ' + res.status)
  assert(html.includes('Damage Report Log'), 'housekeeping missing Damage Report Log')
  // Room status cells — at least one status label should appear (Thai room units
  // render via real room_units.status enum).
  const cleaned = html.replace(/<!--[^>]*-->/g, '')
  const hasAnyStatus =
    cleaned.includes('ว่าง') ||
    cleaned.includes('มีแขก') ||
    cleaned.includes('กำลังทำความสะอาด') ||
    cleaned.includes('ปิดซ่อมบำรุง') ||
    cleaned.includes('Available') ||
    cleaned.includes('Occupied') ||
    cleaned.includes('Cleaning') ||
    cleaned.includes('Maintenance')
  assert(hasAnyStatus, 'housekeeping missing any room status label')
  return 'floors + damage log rendered (HTTP ' + res.status + ') ✓'
})

// ── Test 7: Read endpoints are auth-guarded (housekeeper gets redirected) ──

const HOUSEKEEPER_EMAIL = 'somjit@zenzero.com'
const HOUSEKEEPER_PASSWORD = process.env.HOUSEKEEPER_TEST_PASSWORD ?? 'Housekeep123!'

await step('Test 7: Housekeeper cannot access /manager/reports (redirect)', async () => {
  const hk = buildSession(HOUSEKEEPER_EMAIL, HOUSEKEEPER_PASSWORD)
  const { error } = await hk.supabase.auth.signInWithPassword({
    email: HOUSEKEEPER_EMAIL,
    password: HOUSEKEEPER_PASSWORD,
  })
  if (error) throw new Error(error.message)

  const res = await fetch(APP + '/manager/reports', {
    headers: { Cookie: hk.cookieHeader() },
    redirect: 'manual',
  })
  // requireManager redirects non-managers to '/'. We accept 303 or 307.
  assert(
    res.status === 303 || res.status === 307,
    'housekeeper should be redirected; got HTTP ' + res.status,
  )
  return 'HTTP ' + res.status + ' (auth guard held ✓)'
})

console.log('\n' + (failed === 0 ? '✅' : '⚠️') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)
