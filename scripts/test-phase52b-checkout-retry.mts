/**
 * Phase 52b — "Pay again" after leaving Stripe must not hit
 * "Keys for idempotent requests can only be used with the same parameters".
 *
 * Exercises lib/payments/checkout.ts:openCheckoutSession against Stripe TEST
 * mode only (refuses a live key). No DB rows: the helper only needs a payment
 * id + the stored session id.
 *
 *   1. first call creates a session
 *   2. Pay again while it is open (browser Back) → same session reused
 *   3. a later attempt with no stored id (minute-bucket key) → no idempotency error
 *   4. session expired (Stripe cancel link) → Pay again in the SAME minute → a NEW open session
 *   5. double-click in the same minute with nothing stored → identical session id
 *
 * Run: npx tsx scripts/test-phase52b-checkout-retry.mts
 */
import { config } from 'dotenv'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { openCheckoutSession } from '../lib/payments/checkout'

config({ path: '.env.local' })
const key = process.env.STRIPE_SECRET_KEY ?? ''
if (!key.startsWith('sk_test_')) {
  console.error('STRIPE_SECRET_KEY must be a sk_test_ key — refusing to run against live Stripe')
  process.exit(1)
}
const stripe = new Stripe(key)

let passed = 0
let failed = 0
async function step(name: string, fn: () => Promise<string | void>) {
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

const bookingId = randomUUID()
const paymentId = randomUUID()
const params = {
  bookingId,
  mode: 'payment' as const,
  payment_method_types: ['card' as const],
  line_items: [
    {
      price_data: { currency: 'thb', product_data: { name: 'P52b retry test' }, unit_amount: 100000 },
      quantity: 1,
    },
  ],
  success_url: 'http://localhost:3000/ok',
  cancel_url: 'http://localhost:3000/cancel',
  metadata: { booking_id: bookingId, payment_id: paymentId },
}
const created: string[] = []

console.log('Phase 52b — checkout retry')

let first = ''
await step('1. first Pay click creates a session', async () => {
  const r = await openCheckoutSession(stripe, { id: paymentId, provider_session_id: null }, params)
  assert(r.kind === 'created', `expected created, got ${r.kind}`)
  first = r.session.id
  created.push(first)
  return first
})

await step('2. Pay again while it is still open → reuses the same session', async () => {
  const r = await openCheckoutSession(stripe, { id: paymentId, provider_session_id: first }, params)
  assert(r.kind === 'reused', `expected reused, got ${r.kind}`)
  assert(r.session.id === first, 'should be the same session')
})

await step('3. a later attempt (next minute bucket) → no idempotency error', async () => {
  const later = Date.now() + 2 * 60_000
  const r = await openCheckoutSession(stripe, { id: paymentId, provider_session_id: null }, params, later)
  assert(r.kind === 'created', `expected created, got ${r.kind}`)
  created.push(r.session.id)
})

await step('4. session expired (cancel link) → Pay again same minute → NEW open session', async () => {
  await stripe.checkout.sessions.expire(first)
  const r = await openCheckoutSession(stripe, { id: paymentId, provider_session_id: first }, params)
  assert(r.kind === 'created', `expected created, got ${r.kind}`)
  assert(r.session.id !== first, 'must not hand back the expired session')
  assert(r.session.status === 'open', `new session should be open, got ${r.session.status}`)
  created.push(r.session.id)
})

await step('5. double-click in one minute with nothing stored → same session id', async () => {
  const otherPayment = randomUUID()
  const now = Date.now()
  const a = await openCheckoutSession(stripe, { id: otherPayment, provider_session_id: null }, params, now)
  const b = await openCheckoutSession(stripe, { id: otherPayment, provider_session_id: null }, params, now)
  assert(a.kind === 'created' && b.kind === 'created', 'both should be created responses')
  assert(a.session.id === b.session.id, 'idempotent replay should return the same session')
  created.push(a.session.id)
})

for (const id of new Set(created)) {
  await stripe.checkout.sessions.expire(id).catch(() => undefined)
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
