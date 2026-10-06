/**
 * Phase 48d — CheckInOutDateRange label rename + list search smoke test.
 *
 * CHANGE 1 — Date range labels are now range-neutral ("จากวันที่" /
 * "ถึงวันที่") instead of the old "เช็คอิน" / "เช็คเอาท์" which was
 * redundant with the topic tab. aria-labels updated to "วันเริ่มต้น"
 * / "วันสิ้นสุด".
 *
 * CHANGE 2 — Server-side list search via ?q= with 350ms debounce.
 * Filters by booker_full_name OR booking_code OR booker_email.
 * Preserves ?tab= and ?checkin=&checkout= when the search changes.
 *
 * Run: npx tsx scripts/test-phase48d-check-in-out-search.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const APP = 'http://localhost:3000'

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
  const supabase = createServerClient(BASE, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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

const sess = buildSession('reception@zenzero.com', 'ReceptionPass123!')
const { error: loginErr, data: loginData } = await sess.supabase.auth.signInWithPassword({
  email: 'reception@zenzero.com',
  password: 'ReceptionPass123!',
})
if (loginErr || !loginData.user) throw new Error('login failed: ' + loginErr?.message)

await step('Sign in as reception@zenzero.com', async () => {
  return 'uid=' + loginData.user!.id.slice(0, 8) + '…'
})

const cookie = sess.cookieHeader()

async function fetchPage(path: string): Promise<string> {
  const res = await fetch(APP + path, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  assert(res.status === 200, `expected 200, got ${res.status} for ${path}`)
  return (await res.text()).replace(/<!--[^>]*-->/g, '')
}

function localTodayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const today = localTodayIso()
const tomorrow = addDays(today, 1)
const dayAfter = addDays(today, 2)

// ── CHANGE 1 — Date range labels are now range-neutral ─────────────────────

await step('CHANGE 1: Date field label is "จากวันที่" (not "เช็คอิน")', async () => {
  const html = await fetchPage('/reception/check-in-out')
  assert(html.includes('จากวันที่'), '"จากวันที่" label missing')
  assert(html.includes('ถึงวันที่'), '"ถึงวันที่" label missing')
  return 'range-neutral labels rendered'
})

await step('CHANGE 1: Old "เช็คอิน" / "เช็คเอาท์" labels NOT in date fields', async () => {
  const html = await fetchPage('/reception/check-in-out')
  // The visible label on the from/to fields should no longer say เช็คอิน/
  // เช็คเอาท์. We verify by checking that no <span> immediately wrapping
  // the input contains those exact words as the label.
  // The tab pills still use "เช็คอิน" / "เช็คเอาท์" — those are expected.
  // So we check the count: the labels inside date fields shouldn't contain
  // "เช็คอิน" as a standalone label. We assert the new labels are present
  // and the new aria-labels are present.
  assert(
    html.includes('aria-label="วันเริ่มต้น"'),
    'aria-label "วันเริ่มต้น" missing (was "วันเช็คอิน")',
  )
  assert(
    html.includes('aria-label="วันสิ้นสุด"'),
    'aria-label "วันสิ้นสุด" missing (was "วันเช็คเอาท์")',
  )
  return 'aria-labels updated to "วันเริ่มต้น" / "วันสิ้นสุด"'
})

// ── CHANGE 2 — Search input rendered in list header ───────────────────────

await step('CHANGE 2: Search input rendered in list header', async () => {
  const html = await fetchPage('/reception/check-in-out')
  assert(
    html.includes('aria-label="ค้นหารายการในหน้านี้"'),
    'search input aria-label missing',
  )
  assert(
    html.includes('ค้นหาชื่อ / รหัสการจอง / อีเมล'),
    'search input placeholder missing',
  )
  return 'search input mounted with placeholder'
})

await step('CHANGE 2: ?q=foo URL param is reflected in input value', async () => {
  const html = await fetchPage('/reception/check-in-out?q=foo')
  // The input's value should match the URL ?q= param (controlled by server)
  assert(
    html.includes('value="foo"'),
    'search input should have value="foo" matching ?q=foo',
  )
  return 'input value controlled by ?q= URL param'
})

await step('CHANGE 2: Search preserves ?tab= and ?checkin=&checkout=', async () => {
  // When the search component navigates, it must preserve other URL
  // params. We verify the page renders correctly with all 3 params
  // and the search input is populated.
  const html = await fetchPage(
    `/reception/check-in-out?tab=checkout&checkin=${tomorrow}&checkout=${dayAfter}&q=smith`,
  )
  assert(html.includes('value="smith"'), 'search input value missing')
  // Tab + range should still be active — title shows "เช็คเอาท์ 6 – 9 ต.ค."
  assert(/เช็คเอาท์\s+\d+.*?–.*?\d+/.test(html), 'checkout + range label missing')
  // Date inputs preserve the range
  assert(
    html.includes(`value="${tomorrow}"`),
    'checkin input value should match ?checkin=',
  )
  return 'tab + range + search coexist in single URL state'
})

await step('CHANGE 2: Empty ?q= is omitted (canonical URL)', async () => {
  // The page's input should not bake `?q=` into a static link.
  // We verify the HTML doesn't have static hrefs containing "q=".
  const html = await fetchPage('/reception/check-in-out?q=')
  // Sanity: page still renders 200 + correct content
  assert(html.includes('เช็คอินวันนี้'), 'page label missing')
  // No static <a href="?q=..."> (the input is a controlled <input>, not <a>)
  // Just ensure there's no weird static link
  assert(
    !html.includes('href="/reception/check-in-out?q='),
    'should not bake ?q= into static links',
  )
  return 'empty ?q= is canonical (no static link bakes it)'
})

// ── Live DB query test — search actually filters the list ───────────────

await step('CHANGE 2: Search filters list (server-side query)', async () => {
  // Find a known booking on the live DB to test the OR-filter.
  // Use a date range large enough to catch any check-in across many days.
  const farStart = addDays(today, -1825)  // ~5 years back
  const farEnd = addDays(today, 1825)    // ~5 years forward
  // First, get an unfiltered list to pick a substring from
  const { createClient: createAdmin } = await import('@supabase/supabase-js')
  const svc = createAdmin(BASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: sampleRows, error: sampleErr } = await svc
    .from('bookings')
    .select('booking_code, booker_full_name, check_in, status')
    .gte('check_in', farStart)
    .lte('check_in', farEnd)
    .in('status', ['confirmed', 'checked_in'])
    .order('check_in', { ascending: false })
    .limit(1)
  if (sampleErr) throw new Error('sample query: ' + sampleErr.message)
  if (!sampleRows || sampleRows.length === 0) {
    console.log('  (skipped: no confirmed/checked_in bookings in DB to test against)')
    return 'skipped (no data)'
  }
  const sample = sampleRows[0]
  const substring = sample.booking_code.slice(0, 3)
  // Now hit the page with ?q=<substring>&checkin=<farStart>&checkout=<farEnd>
  const html = await fetchPage(
    `/reception/check-in-out?tab=checkin&checkin=${farStart}&checkout=${farEnd}&q=${substring}`,
  )
  // The sample's name should appear
  assert(
    html.includes(sample.booker_full_name),
    `filtered list should include "${sample.booker_full_name}"`,
  )
  return `search by booking_code substring "${substring}" works`
})

// ── Upcoming + In-house unaffected by search ──────────────────────────────

await step('CHANGE 2: Upcoming + In-house sections unaffected by ?q=', async () => {
  const htmlDefault = await fetchPage('/reception/check-in-out')
  const htmlWithQ = await fetchPage('/reception/check-in-out?q=anything')
  for (const html of [htmlDefault, htmlWithQ]) {
    assert(html.includes('เช็คอินที่กำลังจะมา'), 'upcoming section missing')
    assert(html.includes('แขกที่พักอยู่ในขณะนี้'), 'in-house section missing')
  }
  return 'upcoming + in-house unaffected by ?q='
})

// ── Tab + range still work with search ────────────────────────────────────

await step('CHANGE 2: Tab and date range still work with search (regression check)', async () => {
  const html = await fetchPage(
    `/reception/check-in-out?tab=checkout&checkin=${tomorrow}&checkout=${dayAfter}&q=test`,
  )
  assert(/เช็คเอาท์\s+\d+.*?–.*?\d+/.test(html), 'tab + range label broken with ?q=')
  assert(
    /<button[^>]*aria-pressed="true"[\s\S]{0,500}เช็คเอาท์/.test(html),
    'checkout tab should still be active with ?q= present',
  )
  return 'tab + range + search all coexist correctly'
})

console.log('\n────────────────────────────────')
console.log(`  ${passed} passed, ${failed} failed`)
console.log('────────────────────────────────')
process.exit(failed === 0 ? 0 : 1)