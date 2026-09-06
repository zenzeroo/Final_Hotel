/**
 * Phase 17 — Stripe webhook integration test.
 *
 * Verifies that `app/api/payments/webhook/route.ts`:
 *   1. Accepts a signed `checkout.session.completed` event and flips
 *      `bookings.payment_status='paid'` + `payments.status='succeeded'`
 *      + inserts a `booking_events` row (event_type='payment_confirmed').
 *   2. Is idempotent: replaying the same `event.id` does NOT create
 *      duplicate rows (RPC dedupes via `provider_event_id` UNIQUE).
 *   3. Rejects an event with a wrong signature → HTTP 400.
 *
 * Uses `stripe.webhooks.generateTestHeaderString` to sign synthetic
 * payloads — no live Stripe API call.
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *   - `.env.local` has STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
 *   - Migration 20260902_payments_and_rpc.sql has been applied
 *
 * Run: npx tsx scripts/test-phase17-payment-webhook.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { pgPoolerConfig } from './_db-connection.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const APP = 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY!
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

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

// Service-role client (RLS bypass) — for fixture setup + assertions.
const admin = createServiceClient(SUPABASE_URL, SERVICE_KEY, {
  db: pgPoolerConfig(),
})

const TEST_EMAIL = 'test@zenzero.com'

async function fetchHtml(path: string, cookie?: string): Promise<string> {
  const res = await fetch(APP + path, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: 'manual',
  })
  return res.text()
}

// ── Pre-flight: warm the dev server so /api/* is compiled ────────────────

await step('Precompile /api/payments/webhook (warm Next.js)', async () => {
  const r = await fetchHtml('/api/payments/webhook')
  // First hit on the route typically returns 500 (no signature) — that's fine,
  // we just need Next.js to bundle the route. Expect non-200 with a body.
  return 'status-before-signature-check length=' + r.length
})

// ── Fixture: create test owner + unpaid booking + pending payments row ──

const FAKE_SESSION_ID = 'cs_test_phase17_' + Date.now()
const FAKE_PAYMENT_INTENT = 'pi_test_phase17_' + Date.now()

let ownerId: string
let bookingId: string
let paymentId: string

await step('Seed fixture: owner + unpaid booking + pending payments row', async () => {
  // Owner: reuse the standard test@zenzero.com user if it exists, else create one.
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (found) {
    ownerId = found.id
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: 'Phase 17 Test' },
    })
    if (createErr || !created.user) throw new Error('failed to create owner: ' + createErr?.message)
    ownerId = created.user.id
  }

  // Pick any active room type for the booking fixture.
  const { data: rt, error: rtErr } = await admin
    .from('room_types')
    .select('id, base_price')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (rtErr || !rt) throw new Error('no active room_type seeded')

  // Insert unpaid booking.
  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .insert({
      booking_code: 'ZZR-PH17T' + Date.now().toString().slice(-5),
      user_id: ownerId,
      room_type_id: rt.id,
      check_in: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      check_out: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10),
      guests: 2,
      nights: 2,
      base_subtotal: rt.base_price * 2,
      discount_total: 0,
      tax_total: 0,
      fee_total: 0,
      total: rt.base_price * 2,
      currency: 'THB',
      status: 'confirmed',
      payment_status: 'unpaid',
      booker_full_name: 'Phase 17 Test',
      booker_email: TEST_EMAIL,
      booker_phone: '0890000010',
      channel: 'web',
    })
    .select('id')
    .single()
  if (bookingErr || !booking) throw new Error('booking insert failed: ' + bookingErr?.message)
  bookingId = booking.id

  // Insert pending payments row keyed by the fake session id.
  const { data: pay, error: payErr } = await admin
    .from('payments')
    .insert({
      booking_id: bookingId,
      provider: 'stripe',
      provider_session_id: FAKE_SESSION_ID,
      payment_method: 'card',
      amount: rt.base_price * 2,
      currency: 'THB',
      status: 'pending',
      metadata: { test: 'phase17-webhook' },
    })
    .select('id')
    .single()
  if (payErr || !pay) throw new Error('payments insert failed: ' + payErr?.message)
  paymentId = pay.id

  return `owner=${ownerId.slice(0, 8)} booking=${bookingId.slice(0, 8)} payment=${paymentId.slice(0, 8)}`
})

// ── Test 1: happy path — signed checkout.session.completed ──────────────

const EVENT_ID = 'evt_test_phase17_' + Date.now()

await step('POST signed checkout.session.completed → 200 + DB flip', async () => {
  const payload = JSON.stringify({
    id: EVENT_ID,
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: FAKE_SESSION_ID,
        object: 'checkout.session',
        payment_intent: FAKE_PAYMENT_INTENT,
        payment_status: 'paid',
        status: 'complete',
        mode: 'payment',
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

  // Verify booking flipped to paid.
  const { data: booking } = await admin
    .from('bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .maybeSingle()
  assert(booking?.payment_status === 'paid', 'bookings.payment_status should be paid, got ' + booking?.payment_status)

  // Verify payments row flipped to succeeded with provider_payment_id + paid_at.
  const { data: pay } = await admin
    .from('payments')
    .select('status, provider_event_id, provider_payment_id, paid_at')
    .eq('id', paymentId)
    .maybeSingle()
  assert(pay?.status === 'succeeded', 'payments.status should be succeeded, got ' + pay?.status)
  assert(pay?.provider_event_id === EVENT_ID, 'provider_event_id mismatch: ' + pay?.provider_event_id)
  assert(pay?.provider_payment_id === FAKE_PAYMENT_INTENT, 'provider_payment_id mismatch')
  assert(pay?.paid_at !== null, 'paid_at should be set')

  // Verify booking_events audit row exists.
  const { data: evt } = await admin
    .from('booking_events')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('event_type', 'payment_confirmed')
    .maybeSingle()
  assert(evt?.id, 'no booking_events row with event_type=payment_confirmed')

  return 'booking=paid payment=succeeded event=payment_confirmed'
})

// ── Test 2: idempotency — replay same event.id ───────────────────────────

await step('Replay same event.id → 200 + no duplicate rows', async () => {
  const payload = JSON.stringify({
    id: EVENT_ID, // ← same as Test 1
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: FAKE_SESSION_ID,
        object: 'checkout.session',
        payment_intent: FAKE_PAYMENT_INTENT,
        payment_status: 'paid',
        status: 'complete',
        mode: 'payment',
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

  // Count booking_events rows for this booking — should still be exactly 1.
  const { count } = await admin
    .from('booking_events')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('event_type', 'payment_confirmed')
  assert(count === 1, 'expected 1 booking_events row, got ' + count)

  // Payments row should still be exactly 1.
  const { count: pcount } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('provider_event_id', EVENT_ID)
  assert(pcount === 1, 'expected 1 payments row, got ' + pcount)

  return `events=${count} payments=${pcount}`
})

// ── Test 3: bad signature ────────────────────────────────────────────────

await step('Bad signature → 400', async () => {
  const payload = JSON.stringify({
    id: 'evt_test_bad_' + Date.now(),
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_bad' } },
    livemode: false,
  })

  const res = await fetch(APP + '/api/payments/webhook', {
    method: 'POST',
    headers: {
      // Sign with WRONG secret so HMAC fails verification.
      'stripe-signature': stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_wrong_secret',
      }),
      'Content-Type': 'application/json',
    },
    body: payload,
  })
  assert(res.status === 400, 'expected 400, got ' + res.status)
  return 'status=400 rejected'
})

// ── Cleanup ──────────────────────────────────────────────────────────────

await step('Cleanup fixture (delete test payments + booking_events + bookings)', async () => {
  await admin.from('payments').delete().eq('id', paymentId)
  await admin.from('booking_events').delete().eq('booking_id', bookingId)
  await admin.from('bookings').delete().eq('id', bookingId)
})

console.log('\n' + (failed === 0 ? '✅' : '❌') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)