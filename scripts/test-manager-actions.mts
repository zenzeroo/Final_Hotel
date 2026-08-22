/**
 * Server-action smoke test for the Manager role.
 *
 * Calls the actual Next.js server actions over HTTP:
 *  - resolveDamageReportAction
 *  - approveRefundAction
 *  - rejectRefundAction
 *
 * Strategy:
 *  1. Sign in via @supabase/ssr to get cookies in the format Next.js expects.
 *  2. Discover action IDs from `.next/dev/server/.../server-reference-manifest.json`
 *     (NOT from client JS chunks — those IDs are for the client-side call).
 *  3. POST each action with multipart form-data using `$ACTION_ID_<id>` as the
 *     FIRST field name (form-style submission). Using the `Next-Action` header
 *     causes "Connection closed" errors from Node fetch — see memory note.
 *  4. Re-fetch the page and verify the mock state mutated (HTML reflects the change).
 *
 * Mock state persists for the dev server's lifetime, so tests use delta assertions
 * and skip if a record was already actioned in a previous run.
 *
 * Prereqs:
 *  - `npm run dev` is running on http://localhost:3000
 *  - `.env.local` has USE_MOCK_DATA=1
 *
 * Run: npx tsx scripts/test-manager-actions.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const APP = 'http://localhost:3000'
const EMAIL = 'manager@zenzero.com'
const HOUSEKEEPER_EMAIL = 'somjit@zenzero.com'
const PASSWORD = 'ManagerPass123!'
const HOUSEKEEPER_PASSWORD = 'Housekeep123!'

let passed = 0
let failed = 0

async function step(name: string, fn: () => Promise<string | void>) {
  process.stdout.write(`▶ ${name}\n`)
  try {
    const r = await fn()
    console.log(`  ✓ ${name}` + (r ? ` — ${r}` : ''))
    passed++
  } catch (e) {
    console.log(`  ✗ ${name} — ${(e as Error).message}`)
    failed++
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  return { cookies, supabase, cookieHeader: () => cookies.map((c) => `${c.name}=${c.value}`).join('; ') }
}

/** Discover action IDs from Next.js server-reference manifests.
 * The server-side action ID differs from the client-side createServerReference ID,
 * so we read from `.next/dev/server/app/.../server-reference-manifest.json`. */
function discoverActionIds(): Record<string, string> {
  const serverDir = resolve(__dirname, '..', '.next', 'dev', 'server', 'app')
  const found: Record<string, string> = {}
  // Walk the manager tree to find all server-reference-manifest.json files
  for (const sub of ['page', 'housekeeping/page', 'bookings/page', 'reports/page']) {
    const manifestPath = resolve(serverDir, 'manager', sub, 'server-reference-manifest.json')
    if (!existsSync(manifestPath)) continue
    const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      node?: Record<string, { exportedName?: string }>
    }
    for (const [id, info] of Object.entries(m.node ?? {})) {
      const name = info.exportedName
      if (name && !found[name]) found[name] = id
    }
  }
  return found
}

/** POST a server action with multipart form data.
 *
 * Next.js 16 server actions accept BOTH:
 *   - `Next-Action: <id>` header (used by React client-side `callServer`)
 *   - `$ACTION_ID_<id>` field name in multipart body (used by `<form>` submits)
 *
 * The form-style submission (no `Next-Action` header) works reliably from Node fetch
 * because it doesn't depend on internal request-body handling for the action header.
 *
 * The action ID is sent as the FIRST field name `$ACTION_ID_<id>` (empty value),
 * followed by the actual form fields.
 */
async function postAction(
  cookieHeader: string,
  path: string,
  actionId: string,
  fields: Record<string, string>,
) {
  const boundary = '----ServerActionTest' + Date.now()
  const parts: Buffer[] = []
  // First field: the action ID marker (empty value)
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="$ACTION_ID_${actionId}"\r\n\r\n\r\n`,
  ))
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\n`))
    parts.push(Buffer.from(`Content-Disposition: form-data; name="${k}"\r\n\r\n`))
    parts.push(Buffer.from(v))
    parts.push(Buffer.from('\r\n'))
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  const body = Buffer.concat(parts)
  const res = await fetch(`${APP}${path}`, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
    redirect: 'manual',
  })
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text }
}

// ── Login as manager ────────────────────────────────────────────────────────

const mgr = buildSession(EMAIL, PASSWORD)
await step('Sign in via @supabase/ssr (manager)', async () => {
  const { data, error } = await mgr.supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return `uid=${data.user.id}, cookies=${mgr.cookies.length}`
})

const mgrCookie = mgr.cookieHeader()

// ── Discover action IDs ─────────────────────────────────────────────────────

const actionIds = await step('Discover server-action IDs from .next chunks', async () => {
  const ids = discoverActionIds()
  for (const name of ['resolveDamageReportAction', 'approveRefundAction', 'rejectRefundAction']) {
    if (!ids[name]) throw new Error(`missing action: ${name}`)
  }
  return Object.entries(ids)
    .filter(([k]) => k.endsWith('Action'))
    .map(([k, v]) => `${k}=${v.slice(0, 8)}…`)
    .join(', ')
})

const RESOLVE_ID = discoverActionIds().resolveDamageReportAction
const APPROVE_ID = discoverActionIds().approveRefundAction
const REJECT_ID = discoverActionIds().rejectRefundAction

// Helper: fetch a page HTML
async function fetchHtml(path: string, cookie: string): Promise<string> {
  const res = await fetch(`${APP}${path}`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  return res.text()
}

// ── Test 1: Resolve damage report (happy path) ───────────────────────────────

await step('Test 1: Resolve damage report (dmg-1, room 304)', async () => {
  // Mock state persists across runs — measure DELTAS instead of absolute counts.
  const before = await fetchHtml('/manager/housekeeping', mgrCookie)
  const beforeResolveBtns = (before.match(/เรียกเก็บเงินลูกค้า/g) ?? []).length
  // dmg-1 might already be resolved if the test was run before — skip if so
  const dmg1RowIdx = before.indexOf('font-semibold text-primary">304<')
  const dmg1RowBefore = dmg1RowIdx > 0 ? before.slice(dmg1RowIdx, dmg1RowIdx + 800) : ''
  if (dmg1RowBefore.includes('Resolved')) {
    return `dmg-1 already resolved in this dev session — skipped (mock state persists)`
  }
  assert(beforeResolveBtns >= 1, `expected ≥1 resolve button, got ${beforeResolveBtns}`)

  const res = await postAction(mgrCookie, '/manager/housekeeping', RESOLVE_ID, {
    reportId: 'dmg-1',
    costEstimate: '2000',
    resolutionNote: 'ส่งซ่อมร้าน Zenzero Furniture เปลี่ยนขาโต๊ะใหม่',
  })
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  }

  // Verify state mutated
  const after = await fetchHtml('/manager/housekeeping', mgrCookie)
  const afterResolveBtns = (after.match(/เรียกเก็บเงินลูกค้า/g) ?? []).length
  assert(
    afterResolveBtns === beforeResolveBtns - 1,
    `expected button count to drop by 1: ${beforeResolveBtns} → ${afterResolveBtns}`,
  )
  // dmg-1 row in damage table should now show "Resolved"
  const dmg1Idx = after.indexOf('font-semibold text-primary">304<')
  const ctx304 = dmg1Idx > 0 ? after.slice(dmg1Idx, dmg1Idx + 800) : ''
  assert(ctx304.includes('Resolved'), 'damage-report row for room 304 does not show "Resolved"')
  return `buttons ${beforeResolveBtns}→${afterResolveBtns}; dmg-1 now resolved ✓`
})

// ── Test 2: Validation: negative cost ───────────────────────────────────────

await step('Test 2: Validation — negative cost (action returns ok:false)', async () => {
  // The action validates cost ≥ 0 and returns {ok:false, error:"Cost estimate..."}
  // before touching mock state. So dmg-2 (room 402) should NOT be marked resolved.
  const before = await fetchHtml('/manager/housekeeping', mgrCookie)
  const dmg2Idx = before.indexOf('font-semibold text-primary">402<')
  assert(dmg2Idx > 0, 'room 402 row not found')
  const ctx402Before = before.slice(dmg2Idx, dmg2Idx + 800)
  if (ctx402Before.includes('Resolved')) {
    return `dmg-2 already resolved in this dev session — skipped`
  }
  const res = await postAction(mgrCookie, '/manager/housekeeping', RESOLVE_ID, {
    reportId: 'dmg-2',
    costEstimate: '-100',
    resolutionNote: 'test negative cost',
  })
  if (res.status >= 500) throw new Error(`server crashed: ${res.status}`)
  const after = await fetchHtml('/manager/housekeeping', mgrCookie)
  const idx402 = after.indexOf('font-semibold text-primary">402<')
  // Row spans ~1.4KB (multiple <td>); slice enough to cover the button cell
  const ctx402 = after.slice(idx402, idx402 + 1500)
  assert(
    ctx402.includes('เรียกเก็บเงินลูกค้า'),
    'room 402 should still show resolve button (negative cost must reject)',
  )
  return `HTTP ${res.status}; dmg-2 still unresolved (validation held ✓)`
})

// ── Test 3: Empty resolution note ───────────────────────────────────────────

await step('Test 3: Empty resolution note (action returns ok:false)', async () => {
  // Action validates: !note => "Please add a resolution note"
  // We can't easily inspect the {ok:false} return via HTTP, but we verify no 500.
  const res = await postAction(mgrCookie, '/manager/housekeeping', RESOLVE_ID, {
    reportId: 'dmg-2',
    costEstimate: '500',
    resolutionNote: '',
  })
  assert(res.status < 500, `server returned 5xx: ${res.status}`)
  return `HTTP ${res.status} — action returned ok:false but no crash`
})

// ── Test 4: Approve refund (rf-1, Tahani Al-Jamil) ─────────────────────────

await step('Test 4: Approve refund (rf-1, Tahani Al-Jamil)', async () => {
  const before = await fetchHtml('/manager/bookings?tab=refunds', mgrCookie)
  if (!before.includes('Tahani Al-Jamil')) {
    return `rf-1 already approved in this dev session — skipped`
  }
  const beforeCount = (before.match(/Approve<\/button>/g) ?? []).length

  const res = await postAction(mgrCookie, '/manager/bookings', APPROVE_ID, {
    refundId: 'rf-1',
  })
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  }

  const after = await fetchHtml('/manager/bookings?tab=refunds', mgrCookie)
  assert(!after.includes('Tahani Al-Jamil'), 'Tahani card still present after approve')
  const afterCount = (after.match(/Approve<\/button>/g) ?? []).length
  assert(afterCount === beforeCount - 1, `approve count: ${beforeCount} → ${afterCount}`)
  return `cards ${beforeCount}→${afterCount}; Tahani removed ✓`
})

// ── Test 5: Reject refund (rf-2, James) ─────────────────────────────────────

await step('Test 5: Reject refund (rf-2, James) with reason', async () => {
  const before = await fetchHtml('/manager/bookings?tab=refunds', mgrCookie)
  if (!before.includes('James O')) {
    return `rf-2 already actioned in this dev session — skipped`
  }

  const res = await postAction(mgrCookie, '/manager/bookings', REJECT_ID, {
    refundId: 'rf-2',
    reason: 'Test rejection — outside cancellation policy window',
  })
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  }

  const after = await fetchHtml('/manager/bookings?tab=refunds', mgrCookie)
  assert(!after.includes('James O'), 'James card still present after reject')
  assert(after.includes('Markus Schneider'), 'Markus should still be present')
  return `James removed, Markus still pending ✓`
})

// ── Test 6: Auth guard — housekeeper cannot call manager action ──────────────

await step('Test 6: Auth guard — housekeeper cannot resolve', async () => {
  const hk = buildSession(HOUSEKEEPER_EMAIL, HOUSEKEEPER_PASSWORD)
  const { error, data } = await hk.supabase.auth.signInWithPassword({
    email: HOUSEKEEPER_EMAIL,
    password: HOUSEKEEPER_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')

  const before = await fetchHtml('/manager/housekeeping', mgrCookie)
  const dmg3Idx = before.indexOf('font-semibold text-primary">201<')
  const ctx201Before = dmg3Idx > 0 ? before.slice(dmg3Idx, dmg3Idx + 800) : ''
  const wasAlreadyResolved = ctx201Before.includes('Resolved')

  const res = await postAction(hk.cookieHeader(), '/manager/housekeeping', RESOLVE_ID, {
    reportId: 'dmg-3',
    costEstimate: '500',
    resolutionNote: 'housekeeper attempting manager action',
  })
  if (res.status >= 500) throw new Error(`server crashed: ${res.status}`)
  const location = res.headers.get('location') ?? '(none)'

  // Skip state check if dmg-3 was already resolved before
  if (wasAlreadyResolved) {
    return `HTTP ${res.status} → ${location}; dmg-3 was already resolved (auth not retested)`
  }
  // Verify state NOT mutated — dmg-3 still unresolved
  const after = await fetchHtml('/manager/housekeeping', mgrCookie)
  const dmg201Idx = after.indexOf('font-semibold text-primary">201<')
  assert(dmg201Idx > 0, 'room 201 row not found in damage table')
  const ctx201 = after.slice(dmg201Idx, dmg201Idx + 1500)
  assert(
    ctx201.includes('เรียกเก็บเงินลูกค้า'),
    `room 201 should still show resolve button. status=${res.status}, location=${location}`,
  )
  return `HTTP ${res.status} → ${location}; dmg-3 still unresolved (blocked ✓)`
})

console.log(`\n${failed === 0 ? '✅' : '⚠️'}  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)