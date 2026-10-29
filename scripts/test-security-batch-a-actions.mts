/**
 * Security batch A (20261023) — server-action guards, against a running dev server.
 *
 * Cases:
 *   1. Check-in of a booking whose check-in date is in the future is refused; the room is untouched.
 *   2. Check-in of an unpaid web booking is refused.
 *   3. Check-in of today's walk-in works; check-out works once; a second check-out is
 *      refused and leaves one checked_out event.
 *   4. approveRefundAction on a rejected request is refused before Stripe.
 *   5. rejectRefundAction on an approved request is refused; it stays approved.
 *
 * Prereq: dev server (APP_URL, default http://localhost:3001) with the reception +
 * manager pages compiled once (the test fetches them). Creates throw-away users,
 * bookings and refund rows on the live DB and removes them at the end; the room
 * used in case 3 goes back to its previous status.
 * Run: npx tsx scripts/test-security-batch-a-actions.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP = process.env.APP_URL ?? 'http://localhost:3001'

const svc: SupabaseClient = createClient(BASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let passed = 0
let failed = 0
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log('  ✓ ' + name)
    passed++
  } catch (e) {
    console.log('  ✗ ' + name + ' — ' + (e as Error).message)
    failed++
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const todayBkk = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function createStaff(role: string): Promise<{ id: string; cookie: string }> {
  const email = `sec-a-${role}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const password = `Sec!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
  if (role !== 'user') {
    const { error: e } = await svc.from('profiles').update({ role, is_active: true }).eq('id', data.user.id)
    if (e) throw new Error(`role: ${e.message}`)
  }
  const jar: { name: string; value: string }[] = []
  const ssr = createServerClient(BASE, ANON_KEY, {
    cookies: {
      getAll: () => jar,
      setAll: (set) => {
        for (const { name, value } of set) {
          const i = jar.findIndex((c) => c.name === name)
          if (i >= 0) jar[i] = { name, value }
          else jar.push({ name, value })
        }
      },
    },
  })
  const { error: sErr } = await ssr.auth.signInWithPassword({ email, password })
  if (sErr) throw new Error(`signIn: ${sErr.message}`)
  return { id: data.user.id, cookie: jar.map((c) => `${c.name}=${c.value}`).join('; ') }
}

/**
 * Action ids by exported name. Turbopack writes one manifest per page with
 * `exportedName`; webpack writes one global manifest where the name only
 * appears inside each worker's (URL-encoded) loader moduleId.
 */
function actionIds(page: string): Record<string, string> {
  const server = resolve(__dirname, '..', '.next', 'dev', 'server')
  const perPage = resolve(server, 'app', ...page.split('/'), 'page', 'server-reference-manifest.json')
  const p = existsSync(perPage) ? perPage : resolve(server, 'server-reference-manifest.json')
  if (!existsSync(p)) throw new Error(`manifest missing: ${p}`)
  const m = JSON.parse(readFileSync(p, 'utf8'))
  const out: Record<string, string> = {}
  for (const [id, info] of Object.entries(m.node ?? {})) {
    const entry = info as { exportedName?: string; workers?: Record<string, { moduleId?: string | number }> }
    let name = entry.exportedName
    if (!name) {
      for (const w of Object.values(entry.workers ?? {})) {
        const match = decodeURIComponent(String(w.moduleId ?? '')).match(new RegExp(`"id":"${id}","exportedName":"(\\w+)"`))
        if (match) { name = match[1]; break }
      }
    }
    if (name && !out[name]) out[name] = id
  }
  return out
}

/** Call a server action whose argument is a plain object. */
async function callJson(cookie: string, path: string, id: string, arg: unknown): Promise<string> {
  const res = await fetch(APP + path, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: APP, 'Next-Action': id, 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'text/x-component' },
    body: JSON.stringify([arg]),
    redirect: 'manual',
  })
  return res.text()
}

/** Call a server action whose argument is FormData (encoded like React's encodeReply: root `["$K1"]`, entries prefixed `_1_`). */
async function callForm(cookie: string, path: string, id: string, fields: Record<string, string>): Promise<string> {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append('_1_' + k, v)
  // Root last: the server decodes the multipart body as it streams in.
  fd.append('0', JSON.stringify(['$K1']))
  const res = await fetch(APP + path, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: APP, 'Next-Action': id, Accept: 'text/x-component' },
    body: fd,
    redirect: 'manual',
  })
  return res.text()
}

async function newBooking(guestId: string, roomTypeId: string, checkIn: string, channel: 'web' | 'walk_in'): Promise<string> {
  const code = 'ZZR-' + Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
  const { data, error } = await svc.rpc('create_booking', {
    p_user_id: guestId, p_room_type_id: roomTypeId, p_check_in: checkIn, p_check_out: addDays(checkIn, 1),
    p_guests: 1, p_nights: 1, p_base_subtotal: 1000, p_discount_total: 0, p_tax_total: 0,
    p_fee_total: 0, p_total: 1000, p_currency: 'THB', p_promotion_id: null,
    p_cancellation_policy_id: null, p_booker_full_name: 'Sec Test', p_booker_email: 'sec-test@example.com',
    p_booker_phone: '0812345678', p_special_request: null, p_channel: channel, p_booking_code: code,
  })
  if (error) throw new Error(`create_booking(${channel}, ${checkIn}): ${error.message}`)
  // create_booking returns the new booking id (uuid).
  if (typeof data !== 'string') throw new Error('create_booking returned no id')
  return data
}

async function main() {
  const users: string[] = []
  const bookings: string[] = []
  let restoreRoom: { id: string; status: string } | null = null
  try {
    const reception = await createStaff('reception')
    users.push(reception.id)
    const manager = await createStaff('manager')
    users.push(manager.id)
    const guest = await createStaff('user')
    users.push(guest.id)

    // Compile both pages so their action manifests exist.
    await fetch(APP + '/reception/check-in-out', { headers: { Cookie: reception.cookie } })
    await fetch(APP + '/manager/bookings', { headers: { Cookie: manager.cookie } })
    const rec = actionIds('reception/check-in-out')
    const mgr = actionIds('manager/bookings')
    assert(rec.checkInBookingAction && rec.checkOutBookingAction, 'check-in/out action ids not found')
    assert(mgr.approveRefundAction && mgr.rejectRefundAction, 'refund action ids not found')

    // One free room per type: case 1 + 2 share one type (refused before the room
    // is claimed), case 3 uses the other.
    const { data: units } = await svc
      .from('room_units')
      .select('id, room_type_id, status')
      .eq('is_active', true)
      .in('status', ['available', 'ready'])
    assert(units && units.length >= 2, 'need two free room units')
    const unitA = units[0]
    const unitC = units.find((u) => u.room_type_id !== unitA.room_type_id) ?? units[1]
    const today = todayBkk()

    await step('1. check-in before the check-in date refused, room untouched', async () => {
      const id = await newBooking(guest.id, unitA.room_type_id, addDays(today, 3), 'walk_in')
      bookings.push(id)
      const text = await callJson(reception.cookie, '/reception/check-in-out', rec.checkInBookingAction, {
        bookingId: id, roomUnitId: unitA.id,
      })
      assert(text.includes('ยังไม่ถึงวันเช็คอิน'), `unexpected response: ${text.slice(0, 200)}`)
      const { data: b } = await svc.from('bookings').select('status').eq('id', id).single()
      const { data: u } = await svc.from('room_units').select('status').eq('id', unitA.id).single()
      assert(b?.status === 'confirmed', `booking status ${b?.status}`)
      assert(u?.status === unitA.status, `room status ${u?.status}`)
    })

    await step('2. check-in of an unpaid web booking refused', async () => {
      const id = await newBooking(guest.id, unitA.room_type_id, today, 'web')
      bookings.push(id)
      const text = await callJson(reception.cookie, '/reception/check-in-out', rec.checkInBookingAction, {
        bookingId: id, roomUnitId: unitA.id,
      })
      assert(text.includes('ยังไม่ได้ชำระเงิน'), `unexpected response: ${text.slice(0, 200)}`)
      const { data: b } = await svc.from('bookings').select('status').eq('id', id).single()
      assert(b?.status === 'confirmed', `booking status ${b?.status}`)
    })

    await step('3. walk-in check-in + one check-out; second check-out refused', async () => {
      const id = await newBooking(guest.id, unitC.room_type_id, today, 'walk_in')
      bookings.push(id)
      restoreRoom = { id: unitC.id, status: unitC.status }
      const inText = await callJson(reception.cookie, '/reception/check-in-out', rec.checkInBookingAction, {
        bookingId: id, roomUnitId: unitC.id,
      })
      assert(inText.includes('"ok":true'), `check-in failed: ${inText.slice(0, 200)}`)
      const out1 = await callJson(reception.cookie, '/reception/check-in-out', rec.checkOutBookingAction, { bookingId: id })
      assert(out1.includes('"ok":true'), `check-out failed: ${out1.slice(0, 200)}`)
      const out2 = await callJson(reception.cookie, '/reception/check-in-out', rec.checkOutBookingAction, { bookingId: id })
      assert(out2.includes('พร้อมเช็คเอาท์'), `second check-out not refused: ${out2.slice(0, 200)}`)
      const { count } = await svc
        .from('booking_events')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', id)
        .eq('event_type', 'checked_out')
      assert(count === 1, `checked_out events = ${count}`)
    })

    // Refund rows on the future booking from case 1.
    const refundBooking = bookings[0]
    const { data: rb } = await svc.from('bookings').select('booking_code').eq('id', refundBooking).single()
    const base = { booking_id: refundBooking, booking_code: rb!.booking_code, guest_name: 'Sec Test', reason: 'sec-test', amount: 1000 }

    await step('4. approveRefundAction on a rejected request refused', async () => {
      const { data: rr, error } = await svc.from('refund_requests').insert({ ...base, status: 'rejected', decision_note: 'sec-test' }).select('id').single()
      assert(!error && rr, `insert: ${error?.message}`)
      const text = await callForm(manager.cookie, '/manager/bookings', mgr.approveRefundAction, { refundId: rr.id })
      assert(text.includes('ถูกพิจารณาไปแล้ว'), `unexpected response: ${text.slice(0, 200)}`)
      const { data: after } = await svc.from('refund_requests').select('status').eq('id', rr.id).single()
      assert(after?.status === 'rejected', `status ${after?.status}`)
    })

    await step('5. rejectRefundAction on an approved request refused', async () => {
      const { data: rr, error } = await svc.from('refund_requests').insert({ ...base, status: 'approved' }).select('id').single()
      assert(!error && rr, `insert: ${error?.message}`)
      const text = await callForm(manager.cookie, '/manager/bookings', mgr.rejectRefundAction, { refundId: rr.id, reason: 'sec-test' })
      assert(text.includes('ถูกพิจารณาไปแล้ว'), `unexpected response: ${text.slice(0, 200)}`)
      const { data: after } = await svc.from('refund_requests').select('status').eq('id', rr.id).single()
      assert(after?.status === 'approved', `status ${after?.status}`)
    })
  } finally {
    // Also catch rows whose id never reached the list (a step threw midway).
    const { data: stray } = await svc.from('bookings').select('id').eq('booker_email', 'sec-test@example.com')
    for (const r of stray ?? []) if (!bookings.includes(r.id)) bookings.push(r.id)
    if (bookings.length) {
      await svc.from('housekeeping_tasks').delete().in('booking_id', bookings)
      await svc.from('refund_requests').delete().in('booking_id', bookings)
      await svc.from('booking_events').delete().in('booking_id', bookings)
      await svc.from('notifications').delete().in('booking_id', bookings)
      await svc.from('email_log').delete().in('booking_id', bookings)
      await svc.from('bookings').delete().in('id', bookings)
    }
    const room = restoreRoom as { id: string; status: string } | null
    if (room) await svc.from('room_units').update({ status: room.status }).eq('id', room.id)
    for (const id of users) await svc.auth.admin.deleteUser(id)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
