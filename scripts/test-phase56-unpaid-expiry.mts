/**
 * Phase 56 — unpaid bookings free the room on time.
 *
 *   1. Overdue unpaid bookings no longer block capacity: fill a room type's
 *      pool, push every payment_due_at into the past → create_booking for
 *      the same dates succeeds and has_capacity_for_booking is true.
 *   2. Unpaid bookings still inside their deadline DO block capacity.
 *   3. cleanup_abandoned_unpaid_bookings() flips overdue rows to
 *      expired / payment_deadline.
 *   4. reset_payment_window on an expired booking whose room was re-sold
 *      → ROOM_TAKEN; with the room still free → 'restored'.
 *   5. pg_cron has both per-minute jobs.
 *   6. closeExpiredCheckoutSessions closes the real (test-mode) Stripe
 *      session of an expired booking + marks the payment row expired.
 *   7. Walk-in bookings get no payment deadline.
 *
 * Live DB + Stripe TEST mode. All rows it creates are deleted at the end.
 * Run: npx tsx scripts/test-phase56-unpaid-expiry.mts
 */
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import Stripe from 'stripe'
import { pgPoolerConfig } from './_db-connection.mjs'
import { closeExpiredCheckoutSessions } from '../lib/payments/close-expired-sessions'

loadEnv({ path: '.env.local' })
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ''
if (!BASE || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}
const svc = createClient(BASE, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

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

// ── fixtures ────────────────────────────────────────────────────────────
const email = `phase56-${Math.random().toString(36).slice(2, 8)}@example.com`
const { data: created, error: userErr } = await svc.auth.admin.createUser({
  email,
  password: `Phase56!${Math.random().toString(36).slice(2, 10)}`,
  email_confirm: true,
})
if (userErr || !created.user) throw new Error('createUser: ' + userErr?.message)
const userId = created.user.id
await new Promise((r) => setTimeout(r, 300))

// Smallest active pool keeps the number of fixture rows low.
const { data: units } = await svc.from('room_units').select('room_type_id').eq('is_active', true)
const pools = new Map<string, number>()
for (const u of units ?? []) pools.set(u.room_type_id, (pools.get(u.room_type_id) ?? 0) + 1)
const [roomTypeId, poolSize] = [...pools.entries()].sort((a, b) => a[1] - b[1])[0]

// Far-future dates nobody books; a random offset keeps reruns apart.
function stayDates(slot: number) {
  const d = new Date(Date.UTC(2031, 0, 1))
  d.setUTCDate(d.getUTCDate() + Math.floor(Math.random() * 300) + slot * 3)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + 1)
  return { checkIn: iso(d), checkOut: iso(out) }
}

const bookingIds: string[] = []
async function book(dates: { checkIn: string; checkOut: string }, channel = 'web') {
  const { data, error } = await svc.rpc('create_booking', {
    p_user_id: userId,
    p_room_type_id: roomTypeId,
    p_check_in: dates.checkIn,
    p_check_out: dates.checkOut,
    p_guests: 1,
    p_nights: 1,
    p_base_subtotal: 1000,
    p_discount_total: 0,
    p_tax_total: 70,
    p_fee_total: 150,
    p_total: 1220,
    p_currency: 'THB',
    p_promotion_id: null,
    p_cancellation_policy_id: null,
    p_booker_full_name: 'Phase 56 Test',
    p_booker_email: email,
    p_booker_phone: '0800000056',
    p_special_request: null,
    p_channel: channel,
    p_booking_code: 'T56-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
  })
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
  bookingIds.push(data as string)
  return data as string
}
async function makeOverdue(ids: string[]) {
  const { error } = await svc
    .from('bookings')
    .update({ payment_due_at: new Date(Date.now() - 60_000).toISOString() })
    .in('id', ids)
  if (error) throw new Error('makeOverdue: ' + error.message)
}
async function fillPool(dates: { checkIn: string; checkOut: string }) {
  const ids: string[] = []
  for (let i = 0; i < poolSize; i++) ids.push(await book(dates))
  return ids
}

console.log(`Phase 56 — unpaid expiry (room type ${roomTypeId.slice(0, 8)}, pool ${poolSize})`)

await step('1. overdue unpaid bookings do not block capacity', async () => {
  const dates = stayDates(1)
  const ids = await fillPool(dates)
  await makeOverdue(ids)
  const { data: hasCap } = await svc.rpc('has_capacity_for_booking', { p_booking_id: ids[0] })
  assert(hasCap === true, `has_capacity_for_booking should be true, got ${hasCap}`)
  const fresh = await book(dates)
  return `new booking ${fresh.slice(0, 8)} created over ${poolSize} overdue rows`
})

await step('2. unpaid bookings inside their deadline still block capacity', async () => {
  const dates = stayDates(2)
  await fillPool(dates)
  try {
    await book(dates)
  } catch (e) {
    assert((e as { code?: string }).code === 'P0001', 'expected P0001, got ' + (e as Error).message)
    return 'P0001 No rooms available'
  }
  throw new Error('create_booking should have been refused')
})

let expiredId = ''
let expiredDates = stayDates(3)
await step('3. cleanup_abandoned_unpaid_bookings flips overdue rows', async () => {
  expiredId = await book(expiredDates)
  await makeOverdue([expiredId])
  const { error } = await svc.rpc('cleanup_abandoned_unpaid_bookings')
  if (error) throw new Error(error.message)
  const { data: row } = await svc
    .from('bookings')
    .select('status, lapsed_reason, payment_due_at')
    .eq('id', expiredId)
    .single()
  assert(row?.status === 'expired', `status ${row?.status}`)
  assert(row?.lapsed_reason === 'payment_deadline', `lapsed_reason ${row?.lapsed_reason}`)
  assert(row?.payment_due_at === null, 'payment_due_at should be cleared')
})

await step('4a. reset_payment_window refuses when the room was re-sold', async () => {
  await fillPool(expiredDates)
  const { error } = await svc.rpc('reset_payment_window', { p_booking_id: expiredId })
  assert(error && /ROOM_TAKEN/.test(error.message), 'expected ROOM_TAKEN, got ' + (error?.message ?? 'success'))
  const { data: row } = await svc.from('bookings').select('status').eq('id', expiredId).single()
  assert(row?.status === 'expired', 'booking must stay expired')
})

await step('4b. reset_payment_window re-opens when the room is still free', async () => {
  const dates = stayDates(4)
  const id = await book(dates)
  await makeOverdue([id])
  await svc.rpc('cleanup_abandoned_unpaid_bookings')
  const { data, error } = await svc.rpc('reset_payment_window', { p_booking_id: id })
  if (error) throw new Error(error.message)
  assert(data === 'restored', `expected restored, got ${data}`)
  const { data: row } = await svc.from('bookings').select('status, payment_due_at').eq('id', id).single()
  const left = new Date(row!.payment_due_at!).getTime() - Date.now()
  assert(row?.status === 'confirmed' && left > 4 * 60_000 && left <= 5 * 60_000 + 15_000 /* clock skew */, `status ${row?.status}, ${left}ms left`)
})

await step('5. pg_cron has both per-minute jobs', async () => {
  const c = new pg.Client(pgPoolerConfig())
  await c.connect()
  try {
    const r = await c.query(`select jobname, schedule, active from cron.job where jobname in ('expire-unpaid-bookings','close-expired-stripe-sessions')`)
    const names = r.rows.map((x) => x.jobname).sort().join(',')
    assert(names === 'close-expired-stripe-sessions,expire-unpaid-bookings', 'jobs: ' + names)
    assert(r.rows.every((x) => x.schedule === '* * * * *' && x.active), 'jobs must be active, every minute')
  } finally {
    await c.end()
  }
})

const sessions: string[] = []
await step('6. closeExpiredCheckoutSessions closes the Stripe page of an expired booking', async () => {
  if (!STRIPE_KEY.startsWith('sk_test_')) return 'skipped — needs a sk_test_ key'
  const stripe = new Stripe(STRIPE_KEY)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'thb', product_data: { name: 'P56 test' }, unit_amount: 122000 }, quantity: 1 }],
    success_url: 'http://localhost:3000/ok',
    cancel_url: 'http://localhost:3000/cancel',
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  })
  sessions.push(session.id)
  const { error: insErr } = await svc.from('payments').insert({
    booking_id: expiredId,
    provider: 'stripe',
    provider_session_id: session.id,
    amount: 1220,
    status: 'pending',
  })
  if (insErr) throw new Error('insert payment: ' + insErr.message)

  const result = await closeExpiredCheckoutSessions(stripe, svc)
  const after = await stripe.checkout.sessions.retrieve(session.id)
  assert(after.status === 'expired', `Stripe session status ${after.status}`)
  const { data: pay } = await svc.from('payments').select('status').eq('provider_session_id', session.id).single()
  assert(pay?.status === 'expired', `payment row status ${pay?.status}`)
  return `closed ${result.closed}, failed ${result.failed}`
})

await step('7. walk-in bookings get no payment deadline', async () => {
  const id = await book(stayDates(5), 'walk_in')
  const { data: row } = await svc.from('bookings').select('payment_due_at').eq('id', id).single()
  assert(row?.payment_due_at === null, 'walk-in payment_due_at should be null, got ' + row?.payment_due_at)
})

// ── cleanup ─────────────────────────────────────────────────────────────
if (STRIPE_KEY.startsWith('sk_test_')) {
  const stripe = new Stripe(STRIPE_KEY)
  for (const id of sessions) await stripe.checkout.sessions.expire(id).catch(() => undefined)
}
await svc.from('payments').delete().in('booking_id', bookingIds)
await svc.from('bookings').delete().in('id', bookingIds)
await svc.auth.admin.deleteUser(userId)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
