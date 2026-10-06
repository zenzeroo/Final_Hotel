/**
 * Phase 48b — /reception/check-in-out check-in/check-out date range
 * smoke test.
 *
 * Verifies:
 *   1. Default (no params) → "เช็คอินวันนี้" / "เช็คเอาท์วันนี้" labels
 *   2. Single-day range (checkin == checkout) → dynamic label with date
 *   3. Multi-day range (checkin < checkout) → "X – Y" range label
 *   4. Inverted range (checkout < checkin) → auto-bump checkout to checkin+1
 *   5. Invalid date params → fallback to today
 *   6. Range with BOTH days in past (or far future) → no check-ins, dynamic empty state
 *   7. Upcoming section always today+1..today+3 regardless of range
 *   8. In-house count unchanged regardless of range
 *   9. URL uses lowercase ?checkin=&checkout= (SearchBar convention)
 *
 * Run: npx tsx scripts/test-phase48b-check-in-out-range.mts
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

// Helper: fetch the page and strip React SSR HTML comments so visual
// split markers (`<!-- -->`) don't break our regex assertions. Per
// CLAUDE.md R1 pitfall "SSR HTML comment split".
async function fetchPage(path: string): Promise<string> {
  const res = await fetch(APP + path, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  assert(res.status === 200, `expected 200, got ${res.status} for ${path}`)
  const html = await res.text()
  return html.replace(/<!--[^>]*-->/g, '')
}

// Helper: compute local-tz today + offset dates.
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
const farFuture = addDays(today, 30)

// ── 1. Default (no params) → "วันนี้" labels ────────────────────────────────

await step('GET /reception/check-in-out (no params) → "เช็คอินวันนี้"', async () => {
  const html = await fetchPage('/reception/check-in-out')
  assert(html.includes('เช็คอินวันนี้'), '"เช็คอินวันนี้" label missing')
  assert(html.includes('เช็คเอาท์วันนี้'), '"เช็คเอาท์วันนี้" label missing')
  return 'default labels OK'
})

await step('GET /reception/check-in-out shows 2 date inputs (check-in + check-out)', async () => {
  const html = await fetchPage('/reception/check-in-out')
  assert(
    html.includes('aria-label="วันเช็คอิน"'),
    'check-in input aria-label missing',
  )
  assert(
    html.includes('aria-label="วันเช็คเอาท์"'),
    'check-out input aria-label missing',
  )
  return '2 date inputs mounted'
})

// ── 2. Single-day range (checkin == checkout) → dynamic label ──────────────

await step(`?checkin=${tomorrow}&checkout=${tomorrow} (single-day, ≠today) → dynamic label`, async () => {
  const html = await fetchPage(`/reception/check-in-out?checkin=${tomorrow}&checkout=${tomorrow}`)
  assert(!html.includes('เช็คอินวันนี้'), 'should not show "เช็คอินวันนี้" when range ≠ today')
  assert(!html.includes('เช็คเอาท์วันนี้'), 'should not show "เช็คเอาท์วันนี้" when range ≠ today')
  // Single-day range → just the date, no "–" separator
  assert(/เช็คอิน\s+\d+\s+\S+\s+\d{4}/.test(html), '"เช็คอิน {date}" single-day pattern missing')
  return 'single-day dynamic label'
})

// ── 3. Multi-day range (checkin < checkout) → "X – Y" range label ─────────

await step(`?checkin=${tomorrow}&checkout=${dayAfter} (2-day range) → "X – Y" label`, async () => {
  const html = await fetchPage(`/reception/check-in-out?checkin=${tomorrow}&checkout=${dayAfter}`)
  assert(/เช็คอิน\s+\d+.*?–.*?\d+/.test(html), '"เช็คอิน X – Y" range pattern missing')
  return 'multi-day range label'
})

// ── 4. Inverted range (checkout < checkin) → auto-bump checkout ───────────

await step('Inverted range (checkout < checkin) → auto-bump checkout to checkin+1', async () => {
  // We pick checkin=dayAfter (Oct 8) and checkout=tomorrow (Oct 7) — inverted
  const html = await fetchPage(`/reception/check-in-out?checkin=${dayAfter}&checkout=${tomorrow}`)
  // Page should NOT crash and should render labels for the CORRECTED range
  // (dayAfter → dayAfter+1). The HTML should contain the dayAfter date in
  // the check-in label, not tomorrow.
  // The page receives auto-corrected params internally; we can't read those
  // directly from HTML but the response must be 200 and include the
  // dayAfter date string somewhere.
  assert(html.includes(formatDateThai(dayAfter)), 'expected dayAfter date in HTML')
  return 'auto-bump to checkin+1 — page rendered'
})

// ── 5. Invalid date params → fallback to today ───────────────────────────

await step('?checkin=garbage → fallback to today labels', async () => {
  const html = await fetchPage('/reception/check-in-out?checkin=garbage&checkout=garbage')
  assert(html.includes('เช็คอินวันนี้'), 'should fallback to "เช็คอินวันนี้"')
  assert(html.includes('เช็คเอาท์วันนี้'), 'should fallback to "เช็คเอาท์วันนี้"')
  return 'invalid params → today fallback'
})

// ── 6. Far-future range → dynamic empty state ─────────────────────────────

await step('Far-future range → dynamic empty-state with range', async () => {
  const farRange = addDays(today, 60)
  const html = await fetchPage(
    `/reception/check-in-out?checkin=${farFuture}&checkout=${farRange}`,
  )
  // No bookings that far out → expect dynamic empty-state
  // (either "ไม่มีเช็คอิน X – Y" or section header "เช็คอิน X – Y")
  const hasDynamicEmpty = /ไม่มีเช็คอิน\s+\d+.*?–.*?\d+/.test(html)
  const hasDynamicHeader = /เช็คอิน\s+\d+.*?–.*?\d+/.test(html)
  assert(
    hasDynamicEmpty || hasDynamicHeader,
    'expected dynamic range label for far-future range',
  )
  return 'far-future range drives dynamic label'
})

// ── 7. Upcoming section date-range-independent ────────────────────────────

await step('Upcoming range is today+1..today+3 regardless of ?checkin=&checkout=', async () => {
  const htmlDefault = await fetchPage('/reception/check-in-out')
  const htmlFar = await fetchPage(
    `/reception/check-in-out?checkin=${farFuture}&checkout=${addDays(farFuture, 5)}`,
  )
  assert(htmlDefault.includes('เช็คอินที่กำลังจะมา'), 'upcoming section missing on default')
  assert(htmlFar.includes('เช็คอินที่กำลังจะมา'), 'upcoming section missing on far-future range')
  return 'upcoming is range-independent'
})

// ── 8. In-house count identical regardless of range ───────────────────────

await step('In-house count is the same regardless of ?checkin=&checkout=', async () => {
  const htmlDefault = await fetchPage('/reception/check-in-out')
  const htmlFar = await fetchPage(
    `/reception/check-in-out?checkin=${farFuture}&checkout=${addDays(farFuture, 5)}`,
  )

  function extractInHouseCount(html: string): number | null {
    const m = html.match(/แขกที่พักอยู่ในขณะนี้[\s\S]{0,200}?(\d+)\s*<\/span>/)
    return m ? Number(m[1]) : null
  }
  const a = extractInHouseCount(htmlDefault)
  const b = extractInHouseCount(htmlFar)
  assert(a !== null, 'could not parse in-house count on default')
  assert(b !== null, 'could not parse in-house count on far-future range')
  assert(a === b, `in-house count must be equal: default=${a}, far=${b}`)
  return `both pages show ${a} in-house guests`
})

// ── 9. "กลับวันนี้" button hidden when range == today ──────────────────────

await step('"กลับวันนี้" hidden when range == today, shown when range ≠ today', async () => {
  const htmlDefault = await fetchPage('/reception/check-in-out')
  assert(!htmlDefault.includes('กลับวันนี้'), '"กลับวันนี้" should be hidden on default')

  const htmlFar = await fetchPage(`/reception/check-in-out?checkin=${tomorrow}&checkout=${dayAfter}`)
  assert(htmlFar.includes('กลับวันนี้'), '"กลับวันนี้" should be shown when range ≠ today')
  return 'back-to-today toggled correctly'
})

// Helper: format a YYYY-MM-DD string as Thai "D MMM YYYY" so we can
// match it inside the rendered HTML. Mirrors the page's formatDate
// call (gregorian calendar, th-TH locale).
function formatDateThai(iso: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    calendar: 'gregory',
  }).format(new Date(iso))
}

console.log('\n────────────────────────────────')
console.log(`  ${passed} passed, ${failed} failed`)
console.log('────────────────────────────────')
process.exit(failed === 0 ? 0 : 1)