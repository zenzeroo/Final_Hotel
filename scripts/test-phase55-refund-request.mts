/**
 * Phase 55 — refund request flow (guest asks → manager decides → booking
 * stays active until approval).
 *
 * Cases:
 *   1. request_refund on confirmed+paid → pending row, booking STAYS confirmed, 'refund_requested' event
 *   2. second request for the same booking → REFUND_ALREADY_REQUESTED
 *   3. unpaid booking → REFUND_NOT_ELIGIBLE
 *   4. non-owner authenticated caller → 42501
 *   5. reject (note required) → booking still confirmed, new request still blocked (reject is final)
 *   6. approve_refund → booking cancelled + payment_status refunded + 'cancelled' event
 *   7. outside the free window (0 refund) → REFUND_ZERO, no row created
 *
 * Prereqs: migration 20261012_refund_request_flow.sql applied + NOTIFY pgrst, 'reload schema';
 *          test@zenzero.com fixture (scripts/_rbac-fixture.mts).
 * Run: npx tsx scripts/test-phase55-refund-request.mts
 * Cleanup: bookings with booking_code prefix ZZR-P55-.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!BASE || !SERVICE_KEY || !ANON_KEY) {
  console.error('Supabase env vars required in .env.local')
  process.exit(1)
}
const opts = { auth: { autoRefreshToken: false, persistSession: false } }
const svc = createClient(BASE, SERVICE_KEY, opts)

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

const PREFIX = 'ZZR-P55-'

async function cleanup() {
  const { data: rows } = await svc.from('bookings').select('id').like('booking_code', `${PREFIX}%`)
  if (rows?.length) {
    const ids = rows.map((b) => b.id)
    await svc.from('payments').delete().in('booking_id', ids)
    await svc.from('refund_requests').delete().in('booking_id', ids)
    await svc.from('booking_events').delete().in('booking_id', ids)
    await svc.from('bookings').delete().in('id', ids)
  }
}
await cleanup()

const { data: usersList } = await svc.auth.admin.listUsers()
const owner = usersList?.users.find((u) => u.email === 'test@zenzero.com')
if (!owner) {
  console.error('test@zenzero.com not found — run scripts/_rbac-fixture.mts first')
  process.exit(1)
}
const { data: roomType } = await svc.from('room_types').select('id').eq('is_active', true).limit(1).single()
const { data: flex } = await svc.from('cancellation_policies').select('id').eq('name', 'Flexible').single()
if (!roomType || !flex) {
  console.error('Seed data missing (room_types / Flexible policy)')
  process.exit(1)
}

async function makeBooking(checkIn: string, checkOut: string, paid: boolean): Promise<string> {
  const { data, error } = await svc.rpc('create_booking', {
    p_user_id: owner!.id,
    p_room_type_id: roomType!.id,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_guests: 1,
    p_nights: 1,
    p_base_subtotal: 5000,
    p_discount_total: 0,
    p_tax_total: 0,
    p_fee_total: 0,
    p_total: 5000,
    p_currency: 'THB',
    p_promotion_id: null,
    p_cancellation_policy_id: flex!.id,
    p_booker_full_name: 'P55 Test',
    p_booker_email: 'test@zenzero.com',
    p_booker_phone: '0890000055',
    p_special_request: null,
    p_channel: 'web',
    p_booking_code: `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  })
  if (error || !data) throw new Error(`create_booking failed: ${error?.message}`)
  const id = data as string
  if (paid) {
    const { error: pe } = await svc.from('bookings').update({ payment_status: 'paid' }).eq('id', id)
    if (pe) throw new Error(`mark paid failed: ${pe.message}`)
  }
  return id
}
async function addPayment(bookingId: string) {
  const { error } = await svc.from('payments').insert({
    booking_id: bookingId,
    provider: 'cash',
    payment_method: 'cash',
    amount: 5000,
    currency: 'THB',
    status: 'succeeded',
    paid_at: new Date().toISOString(),
  })
  if (error) throw new Error(`addPayment failed: ${error.message}`)
}
const booking = async (id: string) =>
  (await svc.from('bookings').select('status, payment_status').eq('id', id).single()).data!

console.log('Phase 55 — refund request flow')

const paidA = await makeBooking('2034-03-01', '2034-03-02', true)

await step('1. request on confirmed+paid → pending row, booking stays confirmed', async () => {
  const { data, error } = await svc.rpc('request_refund', { p_booking_id: paidA })
  assert(!error, `rpc error: ${error?.message}`)
  const row = Array.isArray(data) ? data[0] : data
  assert(Number(row.refund_amount) === 5000, `expected 5000, got ${row.refund_amount}`)
  const { data: rr } = await svc.from('refund_requests').select('status, amount').eq('booking_id', paidA)
  assert(rr?.length === 1 && rr[0].status === 'pending', 'expected exactly one pending row')
  const b = await booking(paidA)
  assert(b.status === 'confirmed', `booking should stay confirmed, got ${b.status}`)
  const { data: ev } = await svc.from('booking_events').select('id').eq('booking_id', paidA).eq('event_type', 'refund_requested')
  assert(ev?.length === 1, 'refund_requested event missing')
})

await step('2. second request → REFUND_ALREADY_REQUESTED', async () => {
  const { error } = await svc.rpc('request_refund', { p_booking_id: paidA })
  assert(error?.message.includes('REFUND_ALREADY_REQUESTED'), `got: ${error?.message}`)
})

await step('3. unpaid booking → REFUND_NOT_ELIGIBLE', async () => {
  const unpaid = await makeBooking('2034-03-05', '2034-03-06', false)
  const { error } = await svc.rpc('request_refund', { p_booking_id: unpaid })
  assert(error?.message.includes('REFUND_NOT_ELIGIBLE'), `got: ${error?.message}`)
})

await step('4. non-owner authenticated caller → 42501', async () => {
  const email = `p55-intruder-${Date.now()}@zenzero.test`
  const password = 'P55-Intruder-Pass1!'
  const { data: created, error: ce } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  assert(!ce && created.user, `createUser: ${ce?.message}`)
  try {
    const anon = createClient(BASE, ANON_KEY, opts)
    const { error: se } = await anon.auth.signInWithPassword({ email, password })
    assert(!se, `sign-in: ${se?.message}`)
    const { error } = await anon.rpc('request_refund', { p_booking_id: paidA })
    assert((error as { code?: string } | null)?.code === '42501', `expected 42501, got ${error?.code} ${error?.message}`)
  } finally {
    await svc.auth.admin.deleteUser(created.user!.id)
  }
})

await step('5. reject → booking still confirmed; a new request stays blocked', async () => {
  const { data: rr } = await svc.from('refund_requests').select('id').eq('booking_id', paidA).single()
  const { error: noNote } = await svc
    .from('refund_requests')
    .update({ status: 'rejected', decided_by: owner.id })
    .eq('id', rr!.id)
  assert(noNote, 'reject without a note should violate refund_rejection_requires_note')
  const { error } = await svc
    .from('refund_requests')
    .update({ status: 'rejected', decision_note: 'Outside agreed terms', decided_by: owner.id })
    .eq('id', rr!.id)
  assert(!error, `reject failed: ${error?.message}`)
  assert((await booking(paidA)).status === 'confirmed', 'rejected booking must stay confirmed')
  const { error: again } = await svc.rpc('request_refund', { p_booking_id: paidA })
  assert(again?.message.includes('REFUND_ALREADY_REQUESTED'), `reject must be final, got: ${again?.message}`)
})

await step('6. approve_refund → booking cancelled + refunded + cancelled event', async () => {
  const paidB = await makeBooking('2034-03-10', '2034-03-11', true)
  await addPayment(paidB)
  const { error: re } = await svc.rpc('request_refund', { p_booking_id: paidB })
  assert(!re, `request: ${re?.message}`)
  const { data: rr } = await svc.from('refund_requests').select('id').eq('booking_id', paidB).single()
  // Approve as a real signed-in manager: the 20260919 decision trigger needs
  // auth.uid() to stamp decided_by, so a service_role call is (rightly) refused.
  const email = `p55-manager-${Date.now()}@zenzero.test`
  const password = 'P55-Manager-Pass1!'
  const { data: created, error: ce } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  assert(!ce && created.user, `createUser: ${ce?.message}`)
  try {
    const { error: roleErr } = await svc.from('profiles').update({ role: 'manager' }).eq('id', created.user!.id)
    assert(!roleErr, `set role: ${roleErr?.message}`)
    const mgr = createClient(BASE, ANON_KEY, opts)
    const { error: se } = await mgr.auth.signInWithPassword({ email, password })
    assert(!se, `sign-in: ${se?.message}`)
    const { error } = await mgr.rpc('approve_refund', { p_refund_id: rr!.id })
    assert(!error, `approve: ${error?.message}`)
  } finally {
    await svc.auth.admin.deleteUser(created.user!.id)
  }
  const b = await booking(paidB)
  assert(b.status === 'cancelled', `expected cancelled, got ${b.status}`)
  assert(b.payment_status === 'refunded', `expected refunded, got ${b.payment_status}`)
  const { data: ev } = await svc.from('booking_events').select('id').eq('booking_id', paidB).eq('event_type', 'cancelled')
  assert(ev?.length === 1, 'cancelled event missing')
})

await step('7. outside free window (0 refund) → REFUND_ZERO, no row', async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const soon = await makeBooking(today, tomorrow, true)
  const { error } = await svc.rpc('request_refund', { p_booking_id: soon })
  assert(error?.message.includes('REFUND_ZERO'), `got: ${error?.message}`)
  const { count } = await svc.from('refund_requests').select('id', { count: 'exact', head: true }).eq('booking_id', soon)
  assert(count === 0, 'no refund row should be created')
})

await cleanup()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
