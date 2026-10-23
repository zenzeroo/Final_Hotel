/**
 * Phase 57 — guest refund rule: full refund when asked at least
 * refund_min_days_before_checkin() days before check-in (Asia/Bangkok),
 * otherwise REFUND_TOO_LATE. Cancellation policies no longer matter.
 *
 *   1. min days is 2
 *   2. check-in in 2 days → preview eligible, request = full total
 *   3. check-in in 1 day  → preview not eligible, request REFUND_TOO_LATE
 *   4. check-in today     → REFUND_TOO_LATE
 *   5. Moderate policy (old code: 50%) far ahead → full total
 *   6. preview of a booking that already has a request → already_requested
 *   7. unpaid booking → preview not eligible, request REFUND_NOT_ELIGIBLE
 *
 * Live DB, service role (request_refund allows service_role). Rows deleted
 * at the end. Run: npx tsx scripts/test-phase57-refund-two-day-rule.mts
 */
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: '.env.local' })
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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

const MODERATE = '22222222-2222-2222-2222-222222222222'
const email = `phase57-${Math.random().toString(36).slice(2, 8)}@example.com`
const { data: created, error: userErr } = await svc.auth.admin.createUser({
  email,
  password: `Phase57!${Math.random().toString(36).slice(2, 10)}`,
  email_confirm: true,
})
if (userErr || !created.user) throw new Error('createUser: ' + userErr?.message)
const userId = created.user.id
await new Promise((r) => setTimeout(r, 300))
const { data: unit } = await svc.from('room_units').select('room_type_id').eq('is_active', true).limit(1).single()
const roomTypeId = unit!.room_type_id as string

const bkkToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
function isoInDays(n: number) {
  const d = new Date(bkkToday)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ids: string[] = []
/** A paid booking whose check-in is `days` from today (Bangkok). */
async function paidBooking(days: number, policyId: string | null = null, paid = true) {
  const { data, error } = await svc.rpc('create_booking', {
    p_user_id: userId, p_room_type_id: roomTypeId,
    p_check_in: '2033-01-10', p_check_out: '2033-01-11',
    p_guests: 1, p_nights: 1, p_base_subtotal: 1000, p_discount_total: 0, p_tax_total: 70,
    p_fee_total: 150, p_total: 1220, p_currency: 'THB', p_promotion_id: null,
    p_cancellation_policy_id: policyId, p_booker_full_name: 'Phase 57 Test', p_booker_email: email,
    p_booker_phone: '0800000057', p_special_request: null, p_channel: 'walk_in',
    p_booking_code: 'T57-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
  })
  if (error) throw new Error('create_booking: ' + error.message)
  const id = data as string
  ids.push(id)
  // Move to the target dates afterwards (capacity is not what is under test).
  const { error: upErr } = await svc.from('bookings').update({
    check_in: isoInDays(days), check_out: isoInDays(days + 1),
    payment_status: paid ? 'paid' : 'unpaid',
  }).eq('id', id)
  if (upErr) throw new Error('update: ' + upErr.message)
  return id
}
async function preview(id: string) {
  const { data, error } = await svc.rpc('preview_refund', { p_booking_id: id })
  if (error) throw new Error('preview_refund: ' + error.message)
  return (Array.isArray(data) ? data[0] : data) as {
    days_until: number; min_days: number; eligible: boolean; refund_amount: string; already_requested: boolean
  }
}
async function request(id: string) {
  return svc.rpc('request_refund', { p_booking_id: id })
}

console.log(`Phase 57 — refund 2-day rule (today Bangkok ${isoInDays(0)})`)

await step('1. refund_min_days_before_checkin() = 2', async () => {
  const { data } = await svc.rpc('refund_min_days_before_checkin')
  assert(data === 2, `got ${data}`)
})

await step('2. check-in in 2 days → eligible, full refund', async () => {
  const id = await paidBooking(2)
  const p = await preview(id)
  assert(p.days_until === 2 && p.eligible, `preview ${JSON.stringify(p)}`)
  const { data, error } = await request(id)
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  assert(Number(row.refund_amount) === 1220 && Number(row.penalty_amount) === 0, `row ${JSON.stringify(row)}`)
  const { data: rr } = await svc.from('refund_requests').select('amount, status').eq('booking_id', id).single()
  assert(Number(rr?.amount) === 1220 && rr?.status === 'pending', `refund_requests ${JSON.stringify(rr)}`)
})

await step('3. check-in in 1 day → not eligible, REFUND_TOO_LATE', async () => {
  const id = await paidBooking(1)
  const p = await preview(id)
  assert(p.days_until === 1 && !p.eligible, `preview ${JSON.stringify(p)}`)
  const { error } = await request(id)
  assert(error && /REFUND_TOO_LATE/.test(error.message) && /at least 2/.test(error.message), 'got ' + (error?.message ?? 'success'))
  const { count } = await svc.from('refund_requests').select('id', { count: 'exact', head: true }).eq('booking_id', id)
  assert(count === 0, 'no refund_requests row should exist')
})

await step('4. check-in today → REFUND_TOO_LATE', async () => {
  const id = await paidBooking(0)
  const { error } = await request(id)
  assert(error && /REFUND_TOO_LATE/.test(error.message), 'got ' + (error?.message ?? 'success'))
})

await step('5. Moderate policy far ahead → full total (was 50%)', async () => {
  const id = await paidBooking(30, MODERATE)
  const { data, error } = await request(id)
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  assert(Number(row.refund_amount) === 1220, `refund ${row.refund_amount}`)
})

await step('6. preview after a request → already_requested', async () => {
  const p = await preview(ids[0])
  assert(p.already_requested === true, 'already_requested should be true')
})

await step('7. unpaid booking → not eligible + REFUND_NOT_ELIGIBLE', async () => {
  const id = await paidBooking(10, null, false)
  const p = await preview(id)
  assert(!p.eligible, 'unpaid must not be eligible')
  const { error } = await request(id)
  assert(error && /REFUND_NOT_ELIGIBLE/.test(error.message), 'got ' + (error?.message ?? 'success'))
})

await svc.from('refund_requests').delete().in('booking_id', ids)
await svc.from('bookings').delete().in('id', ids)
await svc.auth.admin.deleteUser(userId)
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
