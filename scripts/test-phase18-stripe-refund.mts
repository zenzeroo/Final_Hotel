/**
 * Phase 18 — Stripe refund wiring integration test.
 *
 * Verifies that Phase 18 closes the gap where manager-approved refunds
 * flipped `bookings.payment_status='refunded'` in Supabase but
 * `stripe.refunds.create()` was never called:
 *
 *   1. POST signed `charge.refunded` webhook → 200 + DB flip
 *      (`payments.status='refunded'`, `bookings.payment_status='refunded'`,
 *      audit row `refund_confirmed`).
 *   2. Replay same `event.id` → 200 + no duplicate rows (idempotent via
 *      `provider_event_id` UNIQUE).
 *   3. `charge.refunded` with missing `payment_intent` → 500 (graceful).
 *   4. Bad HMAC signature → 400.
 *   5. Manager approves Stripe refund → `stripe.refunds.list({ payment_intent })`
 *      confirms 1 new refund + DB flip + audit row `refund_approved`.
 *   6. Manager approves cash refund → skips Stripe call, DB-only flip
 *      (no `refund_confirmed` audit row).
 *   7. RBAC matrix: reception blocked, manager+admin allowed on
 *      `approveRefundAction`.
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *   - `.env.local` has STRIPE_SECRET_KEY (test key) + STRIPE_WEBHOOK_SECRET
 *   - Migrations 20260902_payments_and_rpc.sql + 20260903_confirm_refund_rpc.sql
 *     applied
 *   - PostgREST schema cache reloaded: `NOTIFY pgrst, 'reload schema';`
 *   - Seed users: admin/manager/reception
 *
 * Run: npx tsx scripts/test-phase18-stripe-refund.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { pgPoolerConfig } from './_db-connection.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP = 'http://localhost:3000'
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY!
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

const ADMIN_EMAIL = 'admin@zenzero.com'
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? 'AdminPass123!'
const MANAGER_EMAIL = 'manager@zenzero.com'
const MANAGER_PASSWORD = process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!'
const RECEPTION_EMAIL = 'reception@zenzero.com'
const RECEPTION_PASSWORD = process.env.RECEPTION_TEST_PASSWORD ?? 'ReceptionPass123!'

if (!STRIPE_SECRET || !STRIPE_WEBHOOK_SECRET) {
  console.error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set in .env.local')
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET, { typescript: true })

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

// ── Auth helpers (mirror test-phase10-refund-rpc.mts) ────────────────────

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

async function fetchHtml(path: string, cookie?: string): Promise<string> {
  const res = await fetch(APP + path, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: 'manual',
  })
  return res.text()
}

function discoverActionIds(): Record<string, string> {
  const serverDir = resolve(__dirname, '..', '.next', 'dev', 'server', 'app')
  const found: Record<string, string> = {}
  const manifestPath = resolve(
    serverDir,
    'manager',
    'bookings',
    'page',
    'server-reference-manifest.json',
  )
  if (!existsSync(manifestPath)) return found
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const [id, info] of Object.entries(m.node ?? {})) {
    const name = (info as { exportedName?: string }).exportedName
    if (name && !found[name]) found[name] = id
  }
  return found
}

async function postAction(
  cookieHeader: string,
  path: string,
  actionId: string,
  fields: Record<string, string>,
) {
  const boundary = '----Phase18StripeRefund' + Date.now()
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
  return { status: res.status, text: await res.text() }
}

// ── Service-role admin client (RLS bypass) ───────────────────────────────

const admin = createServiceClient(BASE, SERVICE_KEY, { db: pgPoolerConfig() })

// ── Pre-flight ───────────────────────────────────────────────────────────

await step('Precompile /api/payments/webhook (warm Next.js)', async () => {
  const r = await fetchHtml('/api/payments/webhook')
  return 'first-hit length=' + r.length + ' (any non-200 OK — we just need compile)'
})

// ── Auth: sign in manager + admin + reception ────────────────────────────

const mgr = buildSession()
await step('Sign in as manager', async () => {
  const { error, data } = await mgr.supabase.auth.signInWithPassword({
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return 'uid=' + data.user.id.slice(0, 8)
})
const mgrCookie = mgr.cookieHeader()

const adminSess = buildSession()
await step('Sign in as admin', async () => {
  const { error, data } = await adminSess.supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return 'uid=' + data.user.id.slice(0, 8)
})
const adminCookie = adminSess.cookieHeader()

let recCookie: string | null = null
await step('Sign in as reception (RBAC negative case)', async () => {
  const rec = buildSession()
  const { error, data } = await rec.supabase.auth.signInWithPassword({
    email: RECEPTION_EMAIL,
    password: RECEPTION_PASSWORD,
  })
  if (error) {
    console.log('    (reception user not seeded — RBAC test 7 will skip)')
    return 'skipped: ' + error.message
  }
  if (!data.user) throw new Error('no user')
  recCookie = rec.cookieHeader()
  return 'uid=' + data.user.id.slice(0, 8)
})

// ── Precompile + discover action IDs ─────────────────────────────────────

await step('Precompile /manager/bookings', async () => {
  const r = await fetchHtml('/manager/bookings', mgrCookie)
  return 'length=' + r.length
})

const ids = discoverActionIds()
const APPROVE_REFUND_ID = ids.approveRefundAction
await step('Discover approveRefundAction ID', async () => {
  if (!APPROVE_REFUND_ID) throw new Error('approveRefundAction ID not found in manifest')
  return 'id=' + APPROVE_REFUND_ID.slice(0, 8) + '…'
})

// ── Webhook fixture: booking + succeeded Stripe payment + fake PI ────────

const FAKE_PI = 'pi_test_phase18_' + Date.now()
const FAKE_EVENT_ID = 'evt_test_phase18_' + Date.now()

let stripeBookingId: string
let stripePaymentId: string

await step('Webhook fixture: booking + succeeded Stripe payment', async () => {
  const { data: rt } = await admin
    .from('room_types')
    .select('id, base_price')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!rt) throw new Error('no active room_type seeded')

  const { data: b, error: bErr } = await admin
    .from('bookings')
    .insert({
      booking_code: 'ZZR-PH18W' + Date.now().toString().slice(-5),
      user_id: (
        await admin.from('profiles').select('id').eq('role', 'user').limit(1).maybeSingle()
      ).data?.id,
      room_type_id: rt.id,
      check_in: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      check_out: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10),
      guests: 2,
      nights: 2,
      base_subtotal: rt.base_price * 2,
      total: rt.base_price * 2,
      currency: 'THB',
      status: 'confirmed',
      payment_status: 'paid',
      booker_full_name: 'Phase 18 Webhook Test',
      booker_email: 'phase18-webhook@zenzero.com',
      booker_phone: '0890000011',
      channel: 'web',
    })
    .select('id')
    .single()
  if (bErr || !b) throw new Error('booking insert failed: ' + bErr?.message)
  stripeBookingId = b.id

  const { data: p, error: pErr } = await admin
    .from('payments')
    .insert({
      booking_id: stripeBookingId,
      provider: 'stripe',
      provider_payment_id: FAKE_PI,
      payment_method: 'card',
      amount: rt.base_price * 2,
      currency: 'THB',
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      metadata: { test: 'phase18-webhook' },
    })
    .select('id')
    .single()
  if (pErr || !p) throw new Error('payment insert failed: ' + pErr?.message)
  stripePaymentId = p.id

  return `booking=${stripeBookingId.slice(0, 8)} payment=${stripePaymentId.slice(0, 8)} pi=${FAKE_PI.slice(0, 16)}…`
})

// ── Test 1: signed charge.refunded → 200 + DB flip ───────────────────────

await step('Test 1: POST signed charge.refunded → 200 + DB flip', async () => {
  const payload = JSON.stringify({
    id: FAKE_EVENT_ID,
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test_phase18_' + Date.now(),
        object: 'charge',
        payment_intent: FAKE_PI,
        amount_refunded: 5000,
        refunded: true,
      },
    },
    livemode: false,
  })
  const sig = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  })

  const res = await fetch(APP + '/api/payments/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': sig,
      'Content-Type': 'application/json',
    },
    body: payload,
  })
  assert(res.status === 200, 'expected 200, got ' + res.status + ' body=' + (await res.text()))

  // Verify booking.payment_status flipped to refunded.
  const { data: b } = await admin
    .from('bookings')
    .select('payment_status')
    .eq('id', stripeBookingId)
    .maybeSingle()
  assert(b?.payment_status === 'refunded', 'bookings.payment_status should be refunded, got ' + b?.payment_status)

  // Verify payments.status flipped to refunded + provider_event_id set.
  const { data: p } = await admin
    .from('payments')
    .select('status, provider_event_id')
    .eq('id', stripePaymentId)
    .maybeSingle()
  assert(p?.status === 'refunded', 'payments.status should be refunded, got ' + p?.status)
  assert(p?.provider_event_id === FAKE_EVENT_ID, 'provider_event_id mismatch: ' + p?.provider_event_id)

  // Verify booking_events audit row exists.
  const { data: evt } = await admin
    .from('booking_events')
    .select('id')
    .eq('booking_id', stripeBookingId)
    .eq('event_type', 'refund_confirmed')
    .maybeSingle()
  assert(evt?.id, 'no booking_events row with event_type=refund_confirmed')

  return 'booking=refunded payment=refunded event=refund_confirmed'
})

// ── Test 2: idempotency — replay same event.id ──────────────────────────

await step('Test 2: Replay same event.id → 200 + no duplicate rows', async () => {
  const payload = JSON.stringify({
    id: FAKE_EVENT_ID, // ← same as Test 1
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test_phase18_replay',
        object: 'charge',
        payment_intent: FAKE_PI,
        amount_refunded: 5000,
        refunded: true,
      },
    },
    livemode: false,
  })
  const sig = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  })

  const res = await fetch(APP + '/api/payments/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': sig,
      'Content-Type': 'application/json',
    },
    body: payload,
  })
  assert(res.status === 200, 'expected 200, got ' + res.status)

  // Count booking_events rows — should still be exactly 1.
  const { count } = await admin
    .from('booking_events')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', stripeBookingId)
    .eq('event_type', 'refund_confirmed')
  assert(count === 1, 'expected 1 refund_confirmed row, got ' + count)

  return 'events=' + count + ' (idempotent)'
})

// ── Test 3: missing payment_intent → 500 graceful ────────────────────────

await step('Test 3: charge.refunded with missing payment_intent → 500', async () => {
  const payload = JSON.stringify({
    id: 'evt_test_phase18_no_pi_' + Date.now(),
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test_phase18_no_pi',
        object: 'charge',
        // payment_intent intentionally omitted
        amount_refunded: 1000,
        refunded: true,
      },
    },
    livemode: false,
  })
  const sig = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  })

  const res = await fetch(APP + '/api/payments/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': sig,
      'Content-Type': 'application/json',
    },
    body: payload,
  })
  assert(res.status === 500, 'expected 500, got ' + res.status)
  return 'status=500 (graceful error)'
})

// ── Test 4: bad HMAC signature → 400 ─────────────────────────────────────

await step('Test 4: Bad HMAC signature → 400', async () => {
  const payload = JSON.stringify({
    id: 'evt_test_phase18_bad_sig_' + Date.now(),
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test_phase18_bad_sig',
        object: 'charge',
        payment_intent: FAKE_PI,
        refunded: true,
      },
    },
    livemode: false,
  })

  const res = await fetch(APP + '/api/payments/webhook', {
    method: 'POST',
    headers: {
      // Sign with WRONG secret so HMAC fails.
      'stripe-signature': stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_wrong_secret',
      }),
      'Content-Type': 'application/json',
    },
    body: payload,
  })
  assert(res.status === 400, 'expected 400, got ' + res.status)
  return 'status=400 (signature rejected)'
})

// ── Action fixture: real Stripe PI for refund call ───────────────────────

// For Test 5 we need a real PI so stripe.refunds.create() actually succeeds.
// Create a PaymentIntent directly via the SDK (test mode).

let actionStripeBookingId: string
let actionStripePaymentId: string
let actionStripeRefundId: string | null = null
let actionStripeRefundRequestId: string

await step('Action fixture: real Stripe PI + refund_request', async () => {
  const { data: rt } = await admin
    .from('room_types')
    .select('id, base_price')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!rt) throw new Error('no active room_type seeded')

  // Create a real Stripe PaymentIntent in test mode.
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(rt.base_price * 2 * 100), // satang
    currency: 'thb',
    payment_method_types: ['card'],
    description: 'Phase 18 action test',
  })
  assert(pi.id.startsWith('pi_'), 'expected real PI, got ' + pi.id)

  // Confirm the PI in test mode — auto-success with pm_card_visa.
  // Without confirmation, stripe.refunds.create() rejects (no charge to refund).
  const confirmed = await stripe.paymentIntents.confirm(pi.id, {
    payment_method: 'pm_card_visa',
  })
  assert(confirmed.status === 'succeeded', 'PI should be succeeded after confirm, got ' + confirmed.status)

  const { data: b, error: bErr } = await admin
    .from('bookings')
    .insert({
      booking_code: 'ZZR-PH18A' + Date.now().toString().slice(-5),
      user_id: (
        await admin.from('profiles').select('id').eq('role', 'user').limit(1).maybeSingle()
      ).data?.id,
      room_type_id: rt.id,
      check_in: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      check_out: new Date(Date.now() + 16 * 86400000).toISOString().slice(0, 10),
      guests: 2,
      nights: 2,
      base_subtotal: rt.base_price * 2,
      total: rt.base_price * 2,
      currency: 'THB',
      status: 'confirmed',
      payment_status: 'paid',
      booker_full_name: 'Phase 18 Action Test',
      booker_email: 'phase18-action@zenzero.com',
      booker_phone: '0890000012',
      channel: 'web',
    })
    .select('id')
    .single()
  if (bErr || !b) throw new Error('booking insert failed: ' + bErr?.message)
  actionStripeBookingId = b.id

  const { data: p, error: pErr } = await admin
    .from('payments')
    .insert({
      booking_id: actionStripeBookingId,
      provider: 'stripe',
      provider_payment_id: pi.id,
      payment_method: 'card',
      amount: rt.base_price * 2,
      currency: 'THB',
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      metadata: { test: 'phase18-action-stripe' },
    })
    .select('id')
    .single()
  if (pErr || !p) throw new Error('payment insert failed: ' + pErr?.message)
  actionStripePaymentId = p.id

  const { data: rr, error: rrErr } = await admin
    .from('refund_requests')
    .insert({
      booking_id: actionStripeBookingId,
      booking_code: 'ZZR-PH18A',
      guest_name: 'Phase 18 Action Test',
      reason: 'Test refund (Phase 18)',
      amount: rt.base_price * 2, // full refund
      status: 'pending',
    })
    .select('id')
    .single()
  if (rrErr || !rr) throw new Error('refund_request insert failed: ' + rrErr?.message)
  actionStripeRefundRequestId = rr.id

  return `pi=${pi.id.slice(0, 16)}… refund=${actionStripeRefundRequestId.slice(0, 8)}…`
})

// ── Test 5: manager approves Stripe refund → real Stripe refund ─────────

await step('Test 5: Manager approves Stripe refund → 1 new refund + DB flip', async () => {
  const res = await postAction(mgrCookie, '/manager/bookings', APPROVE_REFUND_ID, {
    refundId: actionStripeRefundRequestId,
  })
  if (res.status >= 500) throw new Error('HTTP ' + res.status + ': ' + res.text.slice(0, 300))

  // Parse the action's JSON response so we can surface errors when DB
  // stayed untouched (Stripe-side failures return {ok:false} with HTTP 200).
  let actionResult: { ok?: boolean; error?: string } = {}
  try {
    actionResult = JSON.parse(res.text || '{}')
  } catch {}
  if (actionResult.ok === false) {
    throw new Error('action returned ok=false: ' + (actionResult.error ?? '(no error msg)'))
  }

  // Verify refund_request was approved.
  const { data: rr } = await admin
    .from('refund_requests')
    .select('status')
    .eq('id', actionStripeRefundRequestId)
    .maybeSingle()
  assert(rr?.status === 'approved', 'refund.status should be approved, got ' + rr?.status)

  // Verify booking.payment_status flipped.
  const { data: b } = await admin
    .from('bookings')
    .select('payment_status')
    .eq('id', actionStripeBookingId)
    .maybeSingle()
  assert(b?.payment_status === 'refunded', 'booking.payment_status should be refunded, got ' + b?.payment_status)

  // Verify audit row from action layer.
  const { data: evt } = await admin
    .from('booking_events')
    .select('id, metadata')
    .eq('booking_id', actionStripeBookingId)
    .eq('event_type', 'refund_approved')
    .maybeSingle()
  assert(evt?.id, 'no refund_approved audit row')
  const md = evt.metadata as { stripe_refund_id?: string } | null
  actionStripeRefundId = md?.stripe_refund_id ?? null
  assert(actionStripeRefundId?.startsWith('re_'), 'audit metadata.stripe_refund_id should be re_…, got ' + actionStripeRefundId)

  // Verify a Stripe refund object was actually created via API.
  // stripe.refunds.list() returns ApiListPromise<Refund> — after await, the
  // result has `.data` already pointing at Refund[] (not at ApiList).
  const refunds = (await stripe.refunds.list({ payment_intent: (
    await admin.from('payments').select('provider_payment_id').eq('id', actionStripePaymentId).maybeSingle()
  ).data?.provider_payment_id as string, limit: 1 })).data
  assert(refunds.length === 1, 'expected 1 Stripe refund, got ' + refunds.length)
  assert(refunds[0].id === actionStripeRefundId, 'Stripe refund id mismatch: ' + refunds[0].id + ' vs ' + actionStripeRefundId)

  return `stripe_refund=${actionStripeRefundId.slice(0, 12)}… audit_row=present`
})

// ── Cash fixture + Test 6 ────────────────────────────────────────────────

let cashBookingId: string
let cashRefundRequestId: string

await step('Cash fixture: walk-in booking + cash payment + refund request', async () => {
  const { data: rt } = await admin
    .from('room_types')
    .select('id, base_price')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!rt) throw new Error('no active room_type seeded')

  const { data: b, error: bErr } = await admin
    .from('bookings')
    .insert({
      booking_code: 'ZZR-PH18C' + Date.now().toString().slice(-5),
      user_id: (
        await admin.from('profiles').select('id').eq('role', 'user').limit(1).maybeSingle()
      ).data?.id,
      room_type_id: rt.id,
      check_in: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
      check_out: new Date(Date.now() + 23 * 86400000).toISOString().slice(0, 10),
      guests: 1,
      nights: 2,
      base_subtotal: rt.base_price * 2,
      total: rt.base_price * 2,
      currency: 'THB',
      status: 'checked_out',
      payment_status: 'paid',
      booker_full_name: 'Phase 18 Cash Test',
      booker_email: 'phase18-cash@zenzero.com',
      booker_phone: '0890000013',
      channel: 'walk_in',
    })
    .select('id')
    .single()
  if (bErr || !b) throw new Error('booking insert failed: ' + bErr?.message)
  cashBookingId = b.id

  await admin.from('payments').insert({
    booking_id: cashBookingId,
    provider: 'cash',
    provider_payment_id: null,
    payment_method: 'cash',
    amount: rt.base_price * 2,
    currency: 'THB',
    status: 'succeeded',
    paid_at: new Date().toISOString(),
    metadata: { test: 'phase18-cash' },
  })

  const { data: rr, error: rrErr } = await admin
    .from('refund_requests')
    .insert({
      booking_id: cashBookingId,
      booking_code: 'ZZR-PH18C',
      guest_name: 'Phase 18 Cash Test',
      reason: 'Cash refund (Phase 18)',
      amount: rt.base_price * 2,
      status: 'pending',
    })
    .select('id')
    .single()
  if (rrErr || !rr) throw new Error('refund_request insert failed: ' + rrErr?.message)
  cashRefundRequestId = rr.id

  return `booking=${cashBookingId.slice(0, 8)} refund=${cashRefundRequestId.slice(0, 8)}`
})

await step('Test 6: Manager approves cash refund → DB-only flip, no Stripe call', async () => {
  const res = await postAction(mgrCookie, '/manager/bookings', APPROVE_REFUND_ID, {
    refundId: cashRefundRequestId,
  })
  if (res.status >= 500) throw new Error('HTTP ' + res.status + ': ' + res.text.slice(0, 300))

  // Surface action-layer errors (e.g. unexpected exception during audit insert).
  let actionResult: { ok?: boolean; error?: string } = {}
  try {
    actionResult = JSON.parse(res.text || '{}')
  } catch {}
  if (actionResult.ok === false) {
    throw new Error('action returned ok=false: ' + (actionResult.error ?? '(no error msg)'))
  }

  // Verify booking.payment_status flipped (DB-only — no Stripe call attempted).
  const { data: b } = await admin
    .from('bookings')
    .select('payment_status')
    .eq('id', cashBookingId)
    .maybeSingle()
  assert(b?.payment_status === 'refunded', 'booking.payment_status should be refunded, got ' + b?.payment_status)

  // Verify only refund_approved audit row (no refund_confirmed since no webhook fires).
  const { data: events } = await admin
    .from('booking_events')
    .select('event_type')
    .eq('booking_id', cashBookingId)
  const types = (events ?? []).map((e) => (e as { event_type: string }).event_type)
  assert(types.includes('refund_approved'), 'expected refund_approved audit row')
  assert(!types.includes('refund_confirmed'), 'cash refund should NOT have refund_confirmed (no webhook)')

  // Verify metadata.partial = false (full refund).
  const { data: evt } = await admin
    .from('booking_events')
    .select('metadata')
    .eq('booking_id', cashBookingId)
    .eq('event_type', 'refund_approved')
    .maybeSingle()
  const md = evt?.metadata as { partial?: boolean; stripe_refund_id?: string | null } | null
  assert(md?.partial === false, 'partial flag should be false for full refund, got ' + md?.partial)
  assert(md?.stripe_refund_id === null, 'cash refund stripe_refund_id should be null, got ' + md?.stripe_refund_id)

  return `booking=refunded audit=refund_approved only (no Stripe call)`
})

// ── Test 7: RBAC matrix on approveRefundAction ───────────────────────────

await step('Test 7a: Manager approves refund (positive case)', async () => {
  // Use the action stripe booking's refund (already approved) — just verify
  // the manager HTTP path works. Test 5 already exercised this.
  // For a fresh test we use a fresh refund request:
  const { data: rr } = await admin
    .from('refund_requests')
    .insert({
      booking_id: actionStripeBookingId,
      booking_code: 'ZZR-PH18A',
      guest_name: 'Phase 18 Manager RBAC',
      reason: 'Manager RBAC test',
      amount: 100,
      status: 'pending',
    })
    .select('id')
    .single()
  if (!rr) throw new Error('refund_request insert failed')

  const res = await postAction(mgrCookie, '/manager/bookings', APPROVE_REFUND_ID, {
    refundId: rr.id,
  })
  // Action returns ok (or some 200). Should not redirect.
  assert(res.status < 400, 'manager should succeed, got HTTP ' + res.status)
  // Surface action-layer errors (e.g. Stripe call failure on second approval).
  let actionResult: { ok?: boolean; error?: string } = {}
  try {
    actionResult = JSON.parse(res.text || '{}')
  } catch {}
  if (actionResult.ok === false) {
    throw new Error('action returned ok=false: ' + (actionResult.error ?? '(no error msg)'))
  }
  return 'HTTP ' + res.status + ' (manager allowed)'
})

await step('Test 7b: Admin approves refund (positive case)', async () => {
  const { data: rr } = await admin
    .from('refund_requests')
    .insert({
      booking_id: cashBookingId,
      booking_code: 'ZZR-PH18C',
      guest_name: 'Phase 18 Admin RBAC',
      reason: 'Admin RBAC test',
      amount: 100,
      status: 'pending',
    })
    .select('id')
    .single()
  if (!rr) throw new Error('refund_request insert failed')

  const res = await postAction(adminCookie, '/manager/bookings', APPROVE_REFUND_ID, {
    refundId: rr.id,
  })
  assert(res.status < 400, 'admin should succeed, got HTTP ' + res.status)
  // Surface action-layer errors (e.g. Stripe call failure on second approval).
  let actionResult: { ok?: boolean; error?: string } = {}
  try {
    actionResult = JSON.parse(res.text || '{}')
  } catch {}
  if (actionResult.ok === false) {
    throw new Error('action returned ok=false: ' + (actionResult.error ?? '(no error msg)'))
  }
  return 'HTTP ' + res.status + ' (admin allowed)'
})

await step('Test 7c: Reception blocked by requireRole', async () => {
  if (!recCookie) {
    console.log('    (skipped — no reception user seeded)')
    return 'skipped'
  }
  const { data: rr } = await admin
    .from('refund_requests')
    .insert({
      booking_id: cashBookingId,
      booking_code: 'ZZR-PH18C',
      guest_name: 'Phase 18 Reception RBAC',
      reason: 'Reception RBAC negative test',
      amount: 50,
      status: 'pending',
    })
    .select('id')
    .single()
  if (!rr) throw new Error('refund_request insert failed')

  const res = await postAction(recCookie, '/manager/bookings', APPROVE_REFUND_ID, {
    refundId: rr.id,
  })
  // Reception lacks role → requireRole redirect → 303 or 307 (RSC redirect).
  // The action returns ActionResult which the framework serializes; either way
  // the refund should NOT be approved. Verify via DB:
  const { data: after } = await admin
    .from('refund_requests')
    .select('status')
    .eq('id', rr.id)
    .maybeSingle()
  assert(after?.status === 'pending', 'reception should NOT have approved; status=' + after?.status)

  return `HTTP ${res.status}, refund still pending (blocked)`
})

// ── Cleanup ──────────────────────────────────────────────────────────────

await step('Cleanup all Phase 18 fixtures', async () => {
  // Stripe payment + booking (already refunded via webhook)
  await admin.from('booking_events').delete().eq('booking_id', stripeBookingId)
  await admin.from('payments').delete().eq('id', stripePaymentId)
  await admin.from('bookings').delete().eq('id', stripeBookingId)
  // Stripe action booking (already refunded via Stripe API)
  await admin.from('booking_events').delete().eq('booking_id', actionStripeBookingId)
  await admin.from('payments').delete().eq('id', actionStripePaymentId)
  await admin
    .from('refund_requests')
    .delete()
    .in('booking_id', [actionStripeBookingId, cashBookingId])
  await admin.from('payments').delete().eq('booking_id', cashBookingId)
  await admin.from('bookings').delete().eq('id', cashBookingId)
  return 'cleaned'
})

console.log('\n' + (failed === 0 ? '✅' : '❌') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)
