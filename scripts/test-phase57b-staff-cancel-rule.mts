/**
 * Phase 57b — staff cancellation (cancel_booking) follows the 2-day rule.
 *
 *   1. paid, check-in in 2 days → cancelled, full refund, pending refund_requests row
 *   2. paid, check-in in 1 day  → cancelled, refund 0, no refund row
 *   3. paid, Moderate policy, 30 days → full total (old code: 50%)
 *   4. unpaid, 10 days → cancelled, refund 0, no row
 *   5. manager override 50 on a 1-day booking → refund = 50%
 *   6. preview_refund: a reception user may preview a guest's booking;
 *      another plain user gets 42501
 *
 * Live DB. cancel_booking via service role = the staff path (cancelBookingByStaff
 * uses the admin client). Rows + users deleted at the end.
 * Run: npx tsx scripts/test-phase57b-staff-cancel-rule.mts
 */
import { config as loadEnv } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

loadEnv({ path: '.env.local' })
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
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
const userIds: string[] = []
async function makeUser(label: string, role?: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `phase57b-${label}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const password = `Phase57b!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error('createUser: ' + error?.message)
  userIds.push(data.user.id)
  await new Promise((r) => setTimeout(r, 300))
  if (role) await svc.from('profiles').update({ role }).eq('id', data.user.id)
  const client = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signErr } = await client.auth.signInWithPassword({ email, password })
  if (signErr) throw new Error('signIn: ' + signErr.message)
  return { id: data.user.id, client }
}

const guest = await makeUser('guest')
const { data: unit } = await svc.from('room_units').select('room_type_id').eq('is_active', true).limit(1).single()
const roomTypeId = unit!.room_type_id as string
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
const inDays = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

const ids: string[] = []
async function booking(days: number, opts: { paid?: boolean; policyId?: string | null } = {}) {
  const { data, error } = await svc.rpc('create_booking', {
    p_user_id: guest.id, p_room_type_id: roomTypeId,
    p_check_in: '2033-03-10', p_check_out: '2033-03-11',
    p_guests: 1, p_nights: 1, p_base_subtotal: 1000, p_discount_total: 0, p_tax_total: 70,
    p_fee_total: 150, p_total: 1220, p_currency: 'THB', p_promotion_id: null,
    p_cancellation_policy_id: opts.policyId ?? null, p_booker_full_name: 'Phase 57b Test',
    p_booker_email: 'phase57b@example.com', p_booker_phone: '0800000058', p_special_request: null,
    p_channel: 'walk_in', p_booking_code: 'T57B-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
  })
  if (error) throw new Error('create_booking: ' + error.message)
  const id = data as string
  ids.push(id)
  await svc.from('bookings').update({
    check_in: inDays(days), check_out: inDays(days + 1),
    payment_status: opts.paid === false ? 'unpaid' : 'paid',
  }).eq('id', id)
  return id
}
async function cancel(id: string, override: number | null = null) {
  const { data, error } = await svc.rpc('cancel_booking', {
    p_booking_id: id, p_staff_override: true, p_refund_pct_override: override,
  })
  if (error) throw new Error('cancel_booking: ' + error.message)
  const row = Array.isArray(data) ? data[0] : data
  const { data: b } = await svc.from('bookings').select('status').eq('id', id).single()
  const { data: rr } = await svc.from('refund_requests').select('amount, status').eq('booking_id', id)
  return { refund: Number(row.refund_amount), status: b?.status, requests: rr ?? [] }
}

console.log(`Phase 57b — staff cancel 2-day rule (today Bangkok ${today})`)

await step('1. paid, 2 days → full refund request', async () => {
  const r = await cancel(await booking(2))
  assert(r.status === 'cancelled', `status ${r.status}`)
  assert(r.refund === 1220, `refund ${r.refund}`)
  assert(r.requests.length === 1 && Number(r.requests[0].amount) === 1220 && r.requests[0].status === 'pending',
    `requests ${JSON.stringify(r.requests)}`)
})

await step('2. paid, 1 day → no refund', async () => {
  const r = await cancel(await booking(1))
  assert(r.status === 'cancelled' && r.refund === 0 && r.requests.length === 0, JSON.stringify(r))
})

await step('3. paid, Moderate policy, 30 days → full total', async () => {
  const r = await cancel(await booking(30, { policyId: MODERATE }))
  assert(r.refund === 1220, `refund ${r.refund}`)
})

await step('4. unpaid, 10 days → no refund', async () => {
  const r = await cancel(await booking(10, { paid: false }))
  assert(r.status === 'cancelled' && r.refund === 0 && r.requests.length === 0, JSON.stringify(r))
})

await step('5. manager override 50% on a 1-day booking', async () => {
  const r = await cancel(await booking(1), 50)
  assert(r.refund === 610 && r.requests.length === 1, JSON.stringify(r))
})

await step('6. preview_refund: reception allowed, other user 42501', async () => {
  const id = await booking(5)
  const reception = await makeUser('reception', 'reception')
  const { data, error } = await reception.client.rpc('preview_refund', { p_booking_id: id })
  if (error) throw new Error('reception preview: ' + error.message)
  const row = Array.isArray(data) ? data[0] : data
  assert(row.days_until === 5 && row.eligible === true, JSON.stringify(row))
  const stranger = await makeUser('stranger')
  const { error: e2 } = await stranger.client.rpc('preview_refund', { p_booking_id: id })
  assert(e2?.code === '42501', 'expected 42501, got ' + (e2?.message ?? 'success'))
})

await svc.from('refund_requests').delete().in('booking_id', ids)
await svc.from('bookings').delete().in('id', ids)
for (const id of userIds) await svc.auth.admin.deleteUser(id)
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
