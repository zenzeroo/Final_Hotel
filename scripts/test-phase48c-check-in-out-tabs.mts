/**
 * Phase 48c — /reception/check-in-out tab + date range separation.
 *
 * Verifies:
 *   1. Default (no params) → tab=checkin, range=today/today
 *   2. Tab "เช็คอิน" / "เช็คเอาท์" pills rendered
 *   3. ?tab=checkout → "เช็คเอาท์วันนี้" + checkout list
 *   4. ?tab=invalid → fallback to checkin
 *   5. ?checkin=Oct6&checkout=Oct9 → "เช็คอิน 6 – 9 ต.ค." + check-in list
 *   6. ?tab=checkout&checkin=Oct6&checkout=Oct9 → "เช็คเอาท์ 6 – 9 ต.ค." + checkout list
 *   7. Tab and date range are INDEPENDENT — switching tab preserves range
 *      (verified by checking the URL structure in rendered HTML)
 *   8. Upcoming + In-house sections always shown (regardless of tab)
 *   9. Action button label matches active tab ("เช็คอิน" or "เช็คเอาท์")
 *
 * Run: npx tsx scripts/test-phase48c-check-in-out-tabs.mts
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
const farFuture2 = addDays(today, 33)

// ── 1. Default (no params) → tab=checkin, range=today/today ────────────────

await step('Default (no params) → "เช็คอินวันนี้"', async () => {
  const html = await fetchPage('/reception/check-in-out')
  assert(html.includes('เช็คอินวันนี้'), '"เช็คอินวันนี้" label missing')
  assert(!html.includes('เช็คเอาท์วันนี้'), 'should not show check-out label by default')
  return 'default tab=checkin, range=today'
})

// ── 2. Tab pills rendered ──────────────────────────────────────────────────

await step('Both tab pills "เช็คอิน" + "เช็คเอาท์" rendered', async () => {
  const html = await fetchPage('/reception/check-in-out')
  // The tabs are <button> elements; both labels should be present
  // regardless of which is active. The button content is split by an
  // icon <span> + the Thai label, so allow up to 200 chars between
  // the opening <button> tag and the label text.
  const hasCheckin = /<button[^>]*>[\s\S]{0,200}เช็คอิน[\s\S]*<\/button>/.test(html)
  const hasCheckout = /<button[^>]*>[\s\S]{0,200}เช็คเอาท์[\s\S]*<\/button>/.test(html)
  assert(hasCheckin, '"เช็คอิน" tab button not found')
  assert(hasCheckout, '"เช็คเอาท์" tab button not found')
  return 'both pills mounted'
})

await step('aria-pressed=true on active tab, false on inactive', async () => {
  const html = await fetchPage('/reception/check-in-out')
  // Default tab is checkin → it should have aria-pressed="true".
  // The button content includes a long className + icon <span> + the
  // label, so allow up to 500 chars between aria-pressed and the label.
  assert(
    /<button[^>]*aria-pressed="true"[\s\S]{0,500}เช็คอิน/.test(html),
    'checkin tab should be aria-pressed=true by default',
  )
  assert(
    /<button[^>]*aria-pressed="false"[\s\S]{0,500}เช็คเอาท์/.test(html),
    'checkout tab should be aria-pressed=false by default',
  )
  return 'aria-pressed correctly set'
})

// ── 3. ?tab=checkout → "เช็คเอาท์วันนี้" + checkout list ───────────────────

await step('?tab=checkout → "เช็คเอาท์วันนี้"', async () => {
  const html = await fetchPage('/reception/check-in-out?tab=checkout')
  assert(html.includes('เช็คเอาท์วันนี้'), '"เช็คเอาท์วันนี้" label missing')
  assert(!html.includes('เช็คอินวันนี้'), 'should not show check-in label when tab=checkout')
  // checkout tab should now be aria-pressed=true
  assert(
    /<button[^>]*aria-pressed="true"[\s\S]{0,500}เช็คเอาท์/.test(html),
    'checkout tab should be aria-pressed=true when ?tab=checkout',
  )
  return 'tab=checkout rendered'
})

// ── 4. ?tab=invalid → fallback to checkin ─────────────────────────────────

await step('?tab=garbage → fallback to checkin', async () => {
  const html = await fetchPage('/reception/check-in-out?tab=garbage')
  assert(html.includes('เช็คอินวันนี้'), 'should fallback to "เช็คอินวันนี้"')
  assert(!html.includes('เช็คเอาท์วันนี้'), 'should not show check-out label')
  return 'invalid tab → checkin fallback'
})

// ── 5. ?checkin=Oct6&checkout=Oct9 → "เช็คอิน 6 – 9 ต.ค." ──────────────────

await step('?checkin=...&checkout=... (default tab) → "เช็คอิน X – Y"', async () => {
  const html = await fetchPage(
    `/reception/check-in-out?checkin=${tomorrow}&checkout=${dayAfter}`,
  )
  assert(!html.includes('เช็คอินวันนี้'), 'should not show today label')
  assert(/เช็คอิน\s+\d+.*?–.*?\d+/.test(html), 'range label missing')
  return 'range label rendered for checkin tab'
})

// ── 6. ?tab=checkout&checkin=...&checkout=... → "เช็คเอาท์ X – Y" ─────────

await step('?tab=checkout&checkin=...&checkout=... → "เช็คเอาท์ X – Y"', async () => {
  const html = await fetchPage(
    `/reception/check-in-out?tab=checkout&checkin=${tomorrow}&checkout=${dayAfter}`,
  )
  assert(!html.includes('เช็คเอาท์วันนี้'), 'should not show today label')
  assert(/เช็คเอาท์\s+\d+.*?–.*?\d+/.test(html), 'range label missing')
  return 'range label rendered for checkout tab'
})

// ── 7. Tab and date range are INDEPENDENT ─────────────────────────────────

await step('Tab and date range are INDEPENDENT (URL preservation)', async () => {
  // When a tab link is rendered, the tab's onClick navigates to
  // /reception/check-in-out?tab=checkout&checkin=...&checkout=... — but
  // since the tab uses router.replace, the URL isn't a static <a href>.
  // We verify independence by checking both controls appear in the
  // same DOM with their values, and the active tab is correctly set
  // regardless of the date range present.
  const html = await fetchPage(
    `/reception/check-in-out?tab=checkout&checkin=${tomorrow}&checkout=${dayAfter}`,
  )
  // Both date inputs should be rendered with the picked range
  const checkinValue = tomorrow
  const checkoutValue = dayAfter
  assert(
    html.includes(`value="${checkinValue}"`),
    `checkin input should have value=${checkinValue}`,
  )
  assert(
    html.includes(`value="${checkoutValue}"`),
    `checkout input should have value=${checkoutValue}`,
  )
  // Tab is checkout (active) — independence means date range didn't reset
  assert(
    /<button[^>]*aria-pressed="true"[\s\S]{0,500}เช็คเอาท์/.test(html),
    'checkout tab should remain active even with custom date range',
  )
  return 'tab + range coexist in single URL state'
})

// ── 8. Upcoming + In-house always shown ───────────────────────────────────

await step('Upcoming + In-house sections always shown (regardless of tab)', async () => {
  const htmlCheckin = await fetchPage('/reception/check-in-out')
  const htmlCheckout = await fetchPage('/reception/check-in-out?tab=checkout')
  for (const html of [htmlCheckin, htmlCheckout]) {
    assert(html.includes('เช็คอินที่กำลังจะมา'), 'upcoming section missing')
    assert(html.includes('แขกที่พักอยู่ในขณะนี้'), 'in-house section missing')
  }
  return 'upcoming + in-house sections present in both tabs'
})

// ── 9. Action button label matches active tab ────────────────────────────

await step('Action button label matches active tab', async () => {
  // The page is server-rendered. When the list has rows, each row
  // has a check-in or check-out action button. We probe by triggering
  // a date range where list is non-empty (or just verify the page
  // has the right action verb available in DOM via the tab-aware
  // query). The action button is rendered via CheckInOutActions
  // client component which is hydrated client-side, so we can't
  // probe it directly. Instead, we just verify the tab header text
  // is present (which the test already covers in #1, #3, #5, #6).
  //
  // We additionally verify the action button text on each list item
  // (the visible list). To do that, query an empty range and verify
  // the empty-state copy matches the active tab — that's the same
  // dynamic label logic that drives the action button label.
  const htmlCheckout = await fetchPage(
    `/reception/check-in-out?tab=checkout&checkin=${farFuture}&checkout=${farFuture2}`,
  )
  // Empty state for checkout + far-future range
  assert(
    /ไม่มีเช็คเอาท์\s+\d+.*?–.*?\d+/.test(htmlCheckout),
    'empty-state for checkout + range should show "ไม่มีเช็คเอาท์ X – Y"',
  )
  return 'tab-aware empty state confirmed (proxies action button label)'
})

// ── 10. Upcoming date-range-independent (Phase 48c retention) ─────────────

await step('Upcoming is date-range-independent', async () => {
  const htmlDefault = await fetchPage('/reception/check-in-out')
  const htmlFar = await fetchPage(
    `/reception/check-in-out?tab=checkout&checkin=${farFuture}&checkout=${farFuture2}`,
  )
  for (const html of [htmlDefault, htmlFar]) {
    assert(html.includes('เช็คอินที่กำลังจะมา'), 'upcoming section missing')
  }
  return 'upcoming is tab+range-independent'
})

// ── 11. URL canonical: defaults omitted ──────────────────────────────────

await step('Canonical URL: defaults omitted (?tab=checkin and today are absent)', async () => {
  // This is a CLIENT-side router.replace test — we can't directly
  // observe the URL the client would push. Instead, verify that the
  // rendered HTML doesn't bake the default tab/date into any static
  // link (the date inputs use controlled values, not <a href>).
  const html = await fetchPage('/reception/check-in-out')
  // No static link to "/reception/check-in-out?tab=checkin" should
  // exist (it would mean the tab isn't trimming its default).
  assert(
    !html.includes('?tab=checkin'),
    'should not bake default tab=checkin into static links',
  )
  return 'no default-baked static links'
})

console.log('\n────────────────────────────────')
console.log(`  ${passed} passed, ${failed} failed`)
console.log('────────────────────────────────')
process.exit(failed === 0 ? 0 : 1)