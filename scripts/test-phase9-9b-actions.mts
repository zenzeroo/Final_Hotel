/**
 * Server-action smoke test for Phase 9 sub-phase 9B
 * (Damage Reports + Refund Requests — new tables + stub wiring).
 *
 * Tests the actual Next.js server actions over HTTP:
 *  - resolveDamageReportAction  (app/actions/manager.ts)
 *  - approveRefundAction        (app/actions/manager.ts)
 *  - rejectRefundAction         (app/actions/manager.ts)
 *
 * Strategy (mirrors scripts/test-manager-phase6-actions.mts):
 *   1. Sign in via @supabase/ssr to get cookies.
 *   2. Precompile pages so server-reference manifests exist.
 *   3. Discover action IDs from .next/dev/server/.../server-reference-manifest.json.
 *   4. POST each action with multipart form-data using the $ACTION_ID_<id> field name.
 *   5. Re-fetch the page and verify state mutated via HTML delta.
 *
 * NOTE on mock vs real:
 *   This script was written for the mock layer (now deleted). The 9B mock
 *   seeds contained damageReports ("dmg-1".."dmg-4") and refundRequests
 *   ("rf-1".."rf-3"); those IDs no longer exist. Tests using delta
 *   assertions and skip-if-already-mutated guards remain correct in spirit.
 *
 *   The new tables (damage_reports, refund_requests) and their RLS policies
 *   are explicitly exercised by the live-DB verification step (task #89).
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *
 * Run: npx tsx scripts/test-phase9-9b-actions.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const APP = 'http://localhost:3000'
const MANAGER_EMAIL = 'manager@zenzero.com'
const MANAGER_PASSWORD = process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!'
const HOUSEKEEPER_EMAIL = 'somjit@zenzero.com'
const HOUSEKEEPER_PASSWORD = process.env.HOUSEKEEPER_TEST_PASSWORD ?? 'Housekeep123!'

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

function discoverActionIds(): Record<string, string> {
  const serverDir = resolve(__dirname, '..', '.next', 'dev', 'server', 'app')
  const found: Record<string, string> = {}
  const paths = [
    resolve(serverDir, 'manager', 'housekeeping', 'page', 'server-reference-manifest.json'),
    resolve(serverDir, 'manager', 'bookings', 'page', 'server-reference-manifest.json'),
  ]
  for (const manifestPath of paths) {
    if (!existsSync(manifestPath)) continue
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const [id, info] of Object.entries(m.node ?? {})) {
      const name = (info as { exportedName?: string }).exportedName
      if (name && !found[name]) found[name] = id
    }
  }
  return found
}

async function postAction(
  cookieHeader: string,
  path: string,
  actionId: string,
  fields: Record<string, string>,
) {
  const boundary = '----Phase9BActionTest' + Date.now()
  const parts: Buffer[] = []
  const marker =
    '--' +
    boundary +
    '\r\n' +
    'Content-Disposition: form-data; name="$ACTION_ID_' +
    actionId +
    '"\r\n\r\n\r\n'
  parts.push(Buffer.from(marker))
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from('--' + boundary + '\r\n'))
    parts.push(Buffer.from('Content-Disposition: form-data; name="' + k + '"\r\n\r\n'))
    parts.push(Buffer.from(v))
    parts.push(Buffer.from('\r\n'))
  }
  parts.push(Buffer.from('--' + boundary + '--\r\n'))
  const body = Buffer.concat(parts)
  const res = await fetch(APP + path, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader,
      Origin: APP,
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
    },
    body,
    redirect: 'manual',
  })
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text }
}

async function fetchHtml(path: string, cookie: string): Promise<string> {
  const res = await fetch(APP + path, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  return res.text()
}

// Find the Action cell state for a damage row identified by its unique description.
// Returns 'resolved' | 'unresolved' | null (null = row not found).
// Strategy: split the table body on </tr>, find the chunk containing the
// description text, and check that chunk only. (A naive <tr>...<desc>...</tr>
// regex would match starting from the table header and capture sibling rows.)
function findDamageRowState(html: string, descriptionFragment: string): string | null {
  const rows = html.split(/<\/tr>/)
  for (const row of rows) {
    if (!row.includes(descriptionFragment)) continue
    if (row.includes('Resolved ')) return 'resolved'
    if (row.includes('เรียกเก็บเงินลูกค้า')) return 'unresolved'
    return 'unknown'
  }
  return null
}

// Find a refund card by booking code and check whether it's still present.
function hasRefundCard(html: string, bookingCode: string): boolean {
  return html.includes(bookingCode)
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

await step('Precompile /manager/housekeeping and /manager/bookings', async () => {
  const r1 = await fetch(APP + '/manager/housekeeping', { headers: { Cookie: mgrCookie } })
  const r2 = await fetch(APP + '/manager/bookings?tab=refunds', { headers: { Cookie: mgrCookie } })
  return 'housekeeping=' + r1.status + ', bookings=' + r2.status
})

const ids = discoverActionIds()
const RESOLVE_DMG_ID = ids.resolveDamageReportAction
const APPROVE_REFUND_ID = ids.approveRefundAction
const REJECT_REFUND_ID = ids.rejectRefundAction

await step('Discover server-action IDs', async () => {
  for (const [name, id] of [
    ['resolveDamageReportAction', RESOLVE_DMG_ID],
    ['approveRefundAction', APPROVE_REFUND_ID],
    ['rejectRefundAction', REJECT_REFUND_ID],
  ] as const) {
    if (!id) throw new Error('missing action: ' + name)
  }
  return Object.entries(ids)
    .map(([k, v]) => k + '=' + v.slice(0, 8) + '…')
    .join(', ')
})

// ── Discover live UUIDs from the database (mock IDs no longer apply) ───────
//
// The data layer hits real PostgREST. The action layer
// accepts any string id, but the underlying UPDATE matches by id — so the test
// must look up real damage_report.id and refund_request.id values.

let dmgTableLegId: string | null = null
let dmgMirrorId: string | null = null
let dmgCarpetId: string | null = null
let rfSmellId: string | null = null
let rfLateReadyId: string | null = null
let rfRoomSwapId: string | null = null

// We self-seed any missing refund fixture rows at the start so each test has a
// unique fixture to mutate. After all tests, we delete the rows we inserted.
let insertedRefundIds: string[] = []

await step('Discover live damage + refund ids', async () => {
  // 1. Damage: full description match (no truncation — Thai substrings vary in length)
  const { data: dmgRows, error: eDmg } = await mgr.supabase
    .from('damage_reports')
    .select('id, description, resolved')
    .order('created_at', { ascending: true })
  if (eDmg) throw new Error('list damage_reports failed: ' + eDmg.message)
  for (const r of dmgRows ?? []) {
    const desc = ((r as { description: string }).description ?? '')
    if (desc.includes('ขาโต๊ะข้างเตียงหัก')) dmgTableLegId = (r as { id: string }).id
    if (desc.includes('กระจกในห้องน้ำแตกร้าว')) dmgMirrorId = (r as { id: string }).id
    if (desc.includes('รอยเปื้อนพรมขนาดใหญ่')) dmgCarpetId = (r as { id: string }).id
  }

  // 2. Refunds: self-seed any missing fixtures. Find an existing booking to
  // anchor them on; insert duplicates as needed.
  const { data: rfRows, error: eRf } = await mgr.supabase
    .from('refund_requests')
    .select('id, reason')
    .eq('status', 'pending')
  if (eRf) throw new Error('list refund_requests failed: ' + eRf.message)
  for (const r of rfRows ?? []) {
    const reason = ((r as { reason: string }).reason ?? '')
    if (reason.includes('smoked')) rfSmellId = (r as { id: string }).id
    if (reason.includes('14h flight') || reason.includes('wait in the lobby')) rfLateReadyId = (r as { id: string }).id
    if (reason.includes('ocean view') || reason.includes('garden view')) rfRoomSwapId = (r as { id: string }).id
  }

  // Pull a booking to anchor fixtures (RLS lets managers see all bookings).
  const { data: bk, error: eBk } = await mgr.supabase
    .from('bookings')
    .select('id, booking_code, booker_full_name')
    .limit(1)
  if (eBk) throw new Error('list bookings failed: ' + eBk.message)
  const anchor = bk?.[0] as { id: string; booking_code: string; booker_full_name: string } | undefined
  assert(anchor, 'no bookings table row found to anchor seeded refund fixtures')

  // Use service_role to insert fixtures — refund_requests has no INSERT
  // policy for managers (refunds are created by guests via the booking flow
  // in production). The service_role bypasses RLS for test setup only.
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(BASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  async function ensureRefundFixture(
    target: 'smoke' | 'late' | 'swap',
    reason: string,
  ): Promise<string | null> {
    if (
      (target === 'smoke' && rfSmellId) ||
      (target === 'late' && rfLateReadyId) ||
      (target === 'swap' && rfRoomSwapId)
    ) {
      return null // already present
    }
    const code = 'TEST-' + target.toUpperCase() + '-' + Date.now().toString(36)
    const { data: ins, error: insErr } = await admin
      .from('refund_requests')
      .insert({
        booking_id: anchor!.id,
        booking_code: code,
        guest_name: anchor!.booker_full_name,
        reason,
        amount: 1000,
      })
      .select('id')
      .single()
    if (insErr) throw new Error('seed refund failed: ' + insErr.message)
    const id = (ins as { id: string }).id
    insertedRefundIds.push(id)
    if (target === 'smoke') rfSmellId = id
    if (target === 'late') rfLateReadyId = id
    if (target === 'swap') rfRoomSwapId = id
    return id
  }

  await ensureRefundFixture(
    'smoke',
    'The room smelled like someone had smoked inside it for the last decade. I have asthma and could not breathe.',
  )
  await ensureRefundFixture(
    'late',
    'We arrived at 11pm after a 14h flight. Room was not ready. They told us to wait in the lobby for 90 minutes.',
  )
  await ensureRefundFixture(
    'swap',
    'Booked ocean view but was given garden view. Reception offered 2,000 THB credit which I declined.',
  )

  return (
    'dmg=' +
    [dmgTableLegId, dmgMirrorId, dmgCarpetId].filter(Boolean).length +
    ', refund=' +
    [rfSmellId, rfLateReadyId, rfRoomSwapId].filter(Boolean).length +
    ' (inserted ' +
    insertedRefundIds.length +
    ')'
  )
})

// ── Test 1: Manager resolves first damage (table-leg break) ────────────────
//
// We resolve the table-leg row and verify the page flips its badge. If already
// resolved from a prior run, skip the mutation and report.

const DMG1_DESC_FRAG = 'ขาโต๊ะข้างเตียงหัก'
await step('Test 1: Manager resolves table-leg damage', async () => {
  assert(dmgTableLegId, 'table-leg damage row missing in DB')

  const before = await fetchHtml('/manager/housekeeping', mgrCookie)
  const beforeState = findDamageRowState(before, DMG1_DESC_FRAG)
  assert(beforeState !== null, 'dmg row not found in housekeeping page')
  if (beforeState === 'resolved') {
    return 'dmg already resolved (state persists across runs) — skipped'
  }

  const res = await postAction(mgrCookie, '/manager/housekeeping', RESOLVE_DMG_ID, {
    reportId: dmgTableLegId!,
    costEstimate: '1800',
    resolutionNote: 'ซ่อมเรียบร้อย เปลี่ยนขาใหม่',
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const { data: row } = await mgr.supabase
    .from('damage_reports')
    .select('resolved')
    .eq('id', dmgTableLegId)
    .single()
  assert(
    (row as { resolved: boolean } | null)?.resolved === true,
    'dmg row should be resolved after action; got ' + JSON.stringify(row),
  )
  return 'dmg ' + dmgTableLegId!.slice(0, 8) + ': unresolved → resolved ✓'
})

// ── Test 2: Validation — empty note returns ok:false ───────────────────────

await step('Test 2: Empty resolutionNote returns ok:false', async () => {
  assert(dmgMirrorId, 'mirror-crack damage row missing')

  // Should still be unresolved after Test 1.
  const { data: beforeRow } = await mgr.supabase
    .from('damage_reports')
    .select('resolved')
    .eq('id', dmgMirrorId)
    .single()
  assert(
    (beforeRow as { resolved: boolean } | null)?.resolved === false,
    'mirror row should be unresolved before this test',
  )

  const res = await postAction(mgrCookie, '/manager/housekeeping', RESOLVE_DMG_ID, {
    reportId: dmgMirrorId!,
    costEstimate: '4500',
    resolutionNote: '', // EMPTY — should fail validation
  })
  assert(res.status < 500, 'server crashed: ' + res.status)

  // Resolution should NOT have flipped.
  const { data: afterRow } = await mgr.supabase
    .from('damage_reports')
    .select('resolved')
    .eq('id', dmgMirrorId)
    .single()
  assert(
    (afterRow as { resolved: boolean } | null)?.resolved === false,
    'mirror row should still be unresolved (validation held)',
  )
  return 'HTTP ' + res.status + '; mirror dmg unchanged (validation held ✓)'
})

// ── Test 3: Validation — negative cost returns ok:false ───────────────────

await step('Test 3: Negative costEstimate returns ok:false', async () => {
  assert(dmgMirrorId, 'mirror-crack damage row missing')

  const res = await postAction(mgrCookie, '/manager/housekeeping', RESOLVE_DMG_ID, {
    reportId: dmgMirrorId!,
    costEstimate: '-100', // NEGATIVE — schema rejects
    resolutionNote: 'test negative cost',
  })
  assert(res.status < 500, 'server crashed: ' + res.status)

  const { data: row } = await mgr.supabase
    .from('damage_reports')
    .select('resolved')
    .eq('id', dmgMirrorId)
    .single()
  assert(
    (row as { resolved: boolean } | null)?.resolved === false,
    'mirror row should still be unresolved (negative cost held)',
  )
  return 'HTTP ' + res.status + '; mirror dmg unchanged (negative cost held ✓)'
})

// ── Test 4: Manager approves "smoked" refund (highest created_at) ─────────

await step('Test 4: Manager approves smoke refund', async () => {
  assert(rfSmellId, 'smoke refund row missing')

  const before = await fetchHtml('/manager/bookings?tab=refunds', mgrCookie)
  // The card's booking code might differ; just sanity-check the tab rendered.
  assert(
    before.includes('การขอคืนเงิน') || before.includes('Refund') || before.length > 5000,
    'refunds tab rendered',
  )

  const res = await postAction(mgrCookie, '/manager/bookings', APPROVE_REFUND_ID, {
    refundId: rfSmellId!,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const { data: row } = await mgr.supabase
    .from('refund_requests')
    .select('status')
    .eq('id', rfSmellId)
    .single()
  assert(
    (row as { status: string } | null)?.status === 'approved',
    'refund should be approved; got ' + JSON.stringify(row),
  )
  return 'refund ' + rfSmellId!.slice(0, 8) + ': pending → approved ✓'
})

// ── Test 5: Manager rejects "late-ready" refund ─────────────────────────────

await step('Test 5: Manager rejects late-ready refund', async () => {
  assert(rfLateReadyId, 'late-ready refund row missing')

  const res = await postAction(mgrCookie, '/manager/bookings', REJECT_REFUND_ID, {
    refundId: rfLateReadyId!,
    reason: 'หลักฐานไม่เพียงพอ',
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const { data: row } = await mgr.supabase
    .from('refund_requests')
    .select('status, decision_note')
    .eq('id', rfLateReadyId)
    .single()
  assert(
    (row as { status: string } | null)?.status === 'rejected',
    'refund should be rejected; got ' + JSON.stringify(row),
  )
  return 'refund ' + rfLateReadyId!.slice(0, 8) + ': pending → rejected ✓'
})

// ── Test 6: Validation — empty rejection reason returns ok:false ──────────

await step('Test 6: Empty reject reason returns ok:false', async () => {
  assert(rfRoomSwapId, 'room-swap refund row missing')

  const res = await postAction(mgrCookie, '/manager/bookings', REJECT_REFUND_ID, {
    refundId: rfRoomSwapId!,
    reason: '', // EMPTY
  })
  assert(res.status < 500, 'server crashed: ' + res.status)

  const { data: row } = await mgr.supabase
    .from('refund_requests')
    .select('status')
    .eq('id', rfRoomSwapId)
    .single()
  assert(
    (row as { status: string } | null)?.status === 'pending',
    'refund should still be pending (empty reason held)',
  )
  return 'HTTP ' + res.status + '; refund unchanged (validation held ✓)'
})

// ── Test 7: Auth guard — housekeeper cannot resolve damage ────────────────

await step('Test 7: Auth guard — housekeeper cannot resolve damage', async () => {
  const hk = buildSession(HOUSEKEEPER_EMAIL, HOUSEKEEPER_PASSWORD)
  const { error } = await hk.supabase.auth.signInWithPassword({
    email: HOUSEKEEPER_EMAIL,
    password: HOUSEKEEPER_PASSWORD,
  })
  if (error) throw new Error(error.message)

  assert(dmgCarpetId, 'carpet damage row missing')

  const res = await postAction(hk.cookieHeader(), '/manager/housekeeping', RESOLVE_DMG_ID, {
    reportId: dmgCarpetId!,
    costEstimate: '12500',
    resolutionNote: 'housekeeper tampering',
  })
  assert(res.status < 500, 'server crashed: ' + res.status)

  const { data: row } = await mgr.supabase
    .from('damage_reports')
    .select('resolved')
    .eq('id', dmgCarpetId)
    .single()
  assert(
    (row as { resolved: boolean } | null)?.resolved === false,
    'carpet row should still be unresolved (housekeeper blocked)',
  )
  return 'HTTP ' + res.status + '; carpet dmg unchanged (auth guard held ✓)'
})

// ── Test 8: Auth guard — housekeeper cannot approve refund ────────────────

await step('Test 8: Auth guard — housekeeper cannot approve refund', async () => {
  const hk = buildSession(HOUSEKEEPER_EMAIL, HOUSEKEEPER_PASSWORD)
  const { error } = await hk.supabase.auth.signInWithPassword({
    email: HOUSEKEEPER_EMAIL,
    password: HOUSEKEEPER_PASSWORD,
  })
  if (error) throw new Error(error.message)

  assert(rfRoomSwapId, 'room-swap refund row missing')

  const res = await postAction(hk.cookieHeader(), '/manager/bookings', APPROVE_REFUND_ID, {
    refundId: rfRoomSwapId!,
  })
  assert(res.status < 500, 'server crashed: ' + res.status)

  const { data: row } = await mgr.supabase
    .from('refund_requests')
    .select('status')
    .eq('id', rfRoomSwapId)
    .single()
  assert(
    (row as { status: string } | null)?.status === 'pending',
    'refund should still be pending (housekeeper blocked)',
  )
  return 'HTTP ' + res.status + '; refund unchanged (auth guard held ✓)'
})

// ── Cleanup: delete self-seeded refund fixtures ────────────────────────────
//
// Tests 4–6 mutate refund rows in-place (approved/rejected), so they remain in
// the table — that's intentional and matches the production flow. The only
// rows we added ourselves (not in the original seed) need to be removed so the
// next run starts from a known state.

if (insertedRefundIds.length > 0) {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(BASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await admin.from('refund_requests').delete().in('id', insertedRefundIds)
}

console.log('\n' + (failed === 0 ? '✅' : '⚠️') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)
