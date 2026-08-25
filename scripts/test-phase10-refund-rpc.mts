/**
 * Phase 10 — approve_refund RPC integration test.
 *
 * Verifies that the new SECURITY DEFINER RPC `public.approve_refund(uuid)`:
 *   1. Sets refund_requests.status = 'approved', decided_by = auth.uid()
 *   2. Atomically flips bookings.payment_status = 'refunded' on the linked booking
 *   3. Blocks double-decision (already-approved → error)
 *   4. Blocks non-manager/admin callers (RLS-equivalent guard inside RPC)
 *
 * Strategy (mirrors scripts/test-phase9-9a-actions.mts):
 *   1. Sign in as admin/manager via @supabase/ssr cookies.
 *   2. Snapshot refund + booking state, run the action, verify, restore.
 *   3. Direct `.rpc('approve_refund', ...)` calls for negative cases.
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *   - `.env.local` has USE_MOCK_DATA=0 (live DB required — RPC lives in Postgres)
 *   - Migration 20260833_approve_refund_rpc.sql has been applied
 *   - At least 1 pending refund_request exists (seeded by 20260830_damage_refunds.sql)
 *
 * Run: npx tsx scripts/test-phase10-refund-rpc.mts
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
const ADMIN_EMAIL = 'admin@zenzero.com'
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? 'AdminPass123!'
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

function buildSession() {
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
  const boundary = '----Phase10RefundRpcTest' + Date.now()
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

// ── Sign in as admin and manager ─────────────────────────────────────────

const admin = buildSession()
await step('Sign in as admin', async () => {
  const { error, data } = await admin.supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return 'uid=' + data.user.id
})
// Admin session is used only for direct PostgREST queries via admin.supabase;
// HTTP actions go through the manager session below.

const mgr = buildSession()
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

// ── Precompile + discover action IDs ─────────────────────────────────────

await step('Precompile /manager/bookings', async () => {
  const r = await fetchHtml('/manager/bookings', mgrCookie)
  return 'status=200? (length=' + r.length + ')'
})

const ids = discoverActionIds()
const APPROVE_REFUND_ID = ids.approveRefundAction
await step('Discover approveRefundAction ID', async () => {
  if (!APPROVE_REFUND_ID) throw new Error('approveRefundAction ID not found in manifest')
  return 'id=' + APPROVE_REFUND_ID.slice(0, 8) + '…'
})

// ── Find a pending refund ────────────────────────────────────────────────

type RefundRow = {
  id: string
  booking_id: string
  status: string
  decided_at: string | null
  decided_by: string | null
  decision_note: string | null
}

let refund: RefundRow | null = null
let bookingOriginalPayment: string | null = null

await step('Find pending refund + snapshot booking payment_status', async () => {
  const { data, error } = await admin.supabase
    .from('refund_requests')
    .select('id, booking_id, status, decided_at, decided_by, decision_note')
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('no pending refund_requests — seed or manually insert one first')
  refund = data as RefundRow

  const { data: b, error: e2 } = await admin.supabase
    .from('bookings')
    .select('payment_status')
    .eq('id', refund.booking_id)
    .maybeSingle()
  if (e2) throw new Error(e2.message)
  bookingOriginalPayment = (b as { payment_status: string } | null)?.payment_status ?? null

  return 'refund=' + refund.id.slice(0, 8) + '… booking=' + refund.booking_id.slice(0, 8) + '… orig_payment=' + bookingOriginalPayment
})

if (!refund) {
  console.log('\n⚠️  No pending refund — aborting')
  process.exit(1)
}

// ── Test 1: Manager approves via HTTP action → payment_status flips ─────

await step('Test 1: Manager approves refund → bookings.payment_status = refunded', async () => {
  const res = await postAction(mgrCookie, '/manager/bookings', APPROVE_REFUND_ID, {
    refundId: refund!.id,
  })
  if (res.status >= 500) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 300))

  // Verify refund_requests row updated.
  const { data: r2, error: e2 } = await admin.supabase
    .from('refund_requests')
    .select('status, decided_by, decided_at')
    .eq('id', refund!.id)
    .single()
  if (e2) throw new Error(e2.message)
  const row = r2 as { status: string; decided_by: string | null; decided_at: string | null }
  assert(row.status === 'approved', 'refund.status should be approved; got ' + row.status)
  assert(row.decided_by === (await mgr.supabase.auth.getUser()).data.user?.id, 'decided_by should be manager uid')

  // Verify bookings.payment_status flipped (THE KEY ASSERTION).
  const { data: b, error: e3 } = await admin.supabase
    .from('bookings')
    .select('payment_status')
    .eq('id', refund!.booking_id)
    .single()
  if (e3) throw new Error(e3.message)
  const payment = (b as { payment_status: string }).payment_status
  assert(payment === 'refunded', 'bookings.payment_status should be refunded; got ' + payment)

  return 'refund.approved ✓ booking.payment_status=refunded ✓ (HTTP ' + res.status + ')'
})

// ── Cleanup Test 1: restore refund + booking state ───────────────────────

await step('Cleanup Test 1: restore refund + booking state', async () => {
  // Reset refund to pending.
  const { error: e1 } = await admin.supabase
    .from('refund_requests')
    .update({ status: 'pending', decided_at: null, decided_by: null, decision_note: null })
    .eq('id', refund!.id)
  if (e1) throw new Error(e1.message)

  // Restore bookings.payment_status.
  if (bookingOriginalPayment !== null) {
    const { error: e2 } = await admin.supabase
      .from('bookings')
      .update({ payment_status: bookingOriginalPayment })
      .eq('id', refund!.booking_id)
    if (e2) throw new Error(e2.message)
  }
  return 'restored (refund=pending, booking.payment_status=' + bookingOriginalPayment + ')'
})

// ── Test 2: Double-approval blocked ─────────────────────────────────────

await step('Test 2: Double-approval blocked by RPC', async () => {
  // Approve once.
  const { error: e1 } = await mgr.supabase.rpc('approve_refund', { p_refund_id: refund!.id })
  if (e1) throw new Error('first approval RPC failed: ' + e1.message)

  // Try to approve again.
  const { error: e2 } = await mgr.supabase.rpc('approve_refund', { p_refund_id: refund!.id })
  assert(e2 !== null, 'second approval RPC should have returned an error')
  assert(
    /already decided/i.test(e2.message) || /pending/i.test(e2.message),
    'second approval should mention "already decided"; got: ' + e2.message,
  )
  return 'second approval rejected: "' + e2.message.slice(0, 80) + '"'
})

// ── Cleanup Test 2: restore ──────────────────────────────────────────────

await step('Cleanup Test 2: restore refund + booking state', async () => {
  const { error: e1 } = await admin.supabase
    .from('refund_requests')
    .update({ status: 'pending', decided_at: null, decided_by: null, decision_note: null })
    .eq('id', refund!.id)
  if (e1) throw new Error(e1.message)
  if (bookingOriginalPayment !== null) {
    const { error: e2 } = await admin.supabase
      .from('bookings')
      .update({ payment_status: bookingOriginalPayment })
      .eq('id', refund!.booking_id)
    if (e2) throw new Error(e2.message)
  }
  return 'restored'
})

// ── Test 3: Reception cannot call RPC (role guard) ──────────────────────

await step('Test 3: Reception role blocked by RPC', async () => {
  // We don't have a guaranteed reception user seeded. Skip gracefully if
  // the auth call fails — the test is "nice to have" rather than blocking.
  const RECEPTION_EMAIL = 'reception@zenzero.com'
  const RECEPTION_PASSWORD = process.env.RECEPTION_TEST_PASSWORD ?? 'ReceptionPass123!'
  const rec = buildSession(RECEPTION_EMAIL, RECEPTION_PASSWORD)
  const { error: authErr } = await rec.supabase.auth.signInWithPassword({
    email: RECEPTION_EMAIL,
    password: RECEPTION_PASSWORD,
  })
  if (authErr) {
    console.log('    (skipped — no reception test user: ' + authErr.message + ')')
    return 'skipped — reception user not seeded'
  }
  const { error: rpcErr } = await rec.supabase.rpc('approve_refund', { p_refund_id: refund!.id })
  assert(rpcErr !== null, 'reception RPC should have errored')
  assert(
    /not authorized/i.test(rpcErr.message) || /role required/i.test(rpcErr.message),
    'reception error should mention "not authorized"; got: ' + rpcErr.message,
  )
  return 'reception blocked: "' + rpcErr.message.slice(0, 80) + '"'
})

// ── Final cleanup (in case any test left state dirty) ───────────────────

await step('Final safety cleanup', async () => {
  const { error: e1 } = await admin.supabase
    .from('refund_requests')
    .update({ status: 'pending', decided_at: null, decided_by: null, decision_note: null })
    .eq('id', refund!.id)
  if (e1) console.log('    warning: final refund restore failed:', e1.message)
  if (bookingOriginalPayment !== null) {
    const { error: e2 } = await admin.supabase
      .from('bookings')
      .update({ payment_status: bookingOriginalPayment })
      .eq('id', refund!.booking_id)
    if (e2) console.log('    warning: final booking restore failed:', e2.message)
  }
  return 'safety cleanup done'
})

console.log('\n' + (failed === 0 ? '✅' : '⚠️') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)
