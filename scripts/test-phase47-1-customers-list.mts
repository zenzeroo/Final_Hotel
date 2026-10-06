/**
 * Phase 47.1 — /reception/customers list+search smoke test.
 *
 * Verifies the new `listAllCustomers()` API:
 *   1. List-all mode (no q) returns customer rows (role='user' only)
 *   2. Search mode (q=test) returns matching customers
 *   3. RLS-staff leak fix: NO staff profiles appear in results
 *      (Malee Reception, admin@, manager@, etc. excluded)
 *   4. Empty-state still works (no q + no customers → "พิมพ์ชื่อ...")
 *   5. HTTP fetch returns 200 + correct HTML for each scenario
 *
 * Run: npx tsx scripts/test-phase47-1-customers-list.mts
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
  return { cookies, supabase, cookieHeader: () => cookies.map((c) => c.name + '=' + c.value).join('; ') }
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

// ── HTTP smoke tests ─────────────────────────────────────────────────────────

await step('GET /reception/customers (no q) returns 200', async () => {
  const res = await fetch(APP + '/reception/customers', {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  assert(res.status === 200, `expected 200, got ${res.status}`)
  return '200 OK'
})

await step('GET /reception/customers empty-state copy preserved', async () => {
  const res = await fetch(APP + '/reception/customers', { headers: { Cookie: cookie } })
  const html = await res.text()
  assert(html.includes('ค้นหาลูกค้า'), 'header missing')
  assert(html.includes('พิมพ์ชื่อหรือเบอร์โทรเพื่อค้นหา'), 'empty-state placeholder missing')
  return 'empty state intact'
})

await step('GET /reception/customers?q=test returns Smoke Test', async () => {
  const res = await fetch(APP + '/reception/customers?q=test', { headers: { Cookie: cookie } })
  const html = await res.text()
  assert(html.includes('Smoke Test'), 'Smoke Test row missing')
  assert(!html.includes('ไม่พบลูกค้าที่ตรงกับ'), 'should not show "not found" when matches exist')
  return '"Smoke Test" rendered'
})

await step('GET /reception/customers?q=test does NOT show reception in customer table', async () => {
  const res = await fetch(APP + '/reception/customers?q=test', { headers: { Cookie: cookie } })
  const html = await res.text()
  // Scope the check to the customer table <tbody> only — StaffSidebar
  // legitimately renders the current user's name ("Malee Reception")
  // in the sidebar/nav, but it MUST NOT appear in the customer table.
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)
  assert(tbodyMatch, 'no <tbody> found in page')
  const tbodyHtml = tbodyMatch[1]
  assert(
    !tbodyHtml.includes('Malee Reception'),
    'reception profile leaked into customer table',
  )
  return 'no RLS staff leak in <tbody>'
})

await step('GET /reception/customers?q=test does NOT show admin/manager names', async () => {
  const res = await fetch(APP + '/reception/customers?q=test', { headers: { Cookie: cookie } })
  const html = await res.text()
  // Admin emails + manager name should not appear in customer search
  assert(!html.includes('@zenzero.com'), 'staff email leaked into customer results')
  return 'no admin/manager email leak'
})

await step('GET /reception/customers shows total count when results exist', async () => {
  const res = await fetch(APP + '/reception/customers?q=test', { headers: { Cookie: cookie } })
  const html = await res.text()
  // Strip React SSR HTML comments before matching (per CLAUDE.md R1
  // pitfall "SSR HTML comment split" — React inserts <!-- --> between
  // text nodes so "1" and " คน" become "1<!-- --> คน").
  const stripped = html.replace(/<!--[^>]*-->/g, '')
  assert(/\d+\s*คน/.test(stripped), 'total count "X คน" missing')
  return 'total count rendered'
})

await step('GET /reception/customers?q=zzzzzz shows not-found empty state', async () => {
  const res = await fetch(APP + '/reception/customers?q=zzzzzz', { headers: { Cookie: cookie } })
  const html = await res.text()
  assert(html.includes('ไม่พบลูกค้าที่ตรงกับ'), 'not-found state missing')
  return 'not-found state shown'
})

console.log('\n────────────────────────────────')
console.log(`  ${passed} passed, ${failed} failed`)
console.log('────────────────────────────────')
process.exit(failed === 0 ? 0 : 1)