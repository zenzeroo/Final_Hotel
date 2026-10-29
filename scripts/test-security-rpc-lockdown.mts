/**
 * 20261022 — booking RPC lockdown + deactivated-staff integration test.
 *
 * Cases:
 *   1. A signed-in guest calling create_booking directly is refused.
 *   2. … create_temp_booking directly is refused.
 *   3. … complete_temp_booking directly is refused.
 *   3b. anon / guest are refused the Stripe webhook RPCs.
 *   4. … get_session_email_for_user(<another user>) is refused.
 *   5. An anonymous caller is refused get_session_email_for_user too.
 *   6. An active reception user: is_staff() and has_role('reception') true.
 *   7. The same user after is_active=false: both false (JWT still valid).
 *   20261023:
 *   8. anon → append_hero_slide / move_hero_slide refused.
 *   9. A signed-in guest → both refused (admin only).
 *  10. An active admin → append + move work (test slide deleted after).
 *  11. guest → cancel_temp_booking with another user's id refused.
 *  12. anon / guest → can_link_identity_by_email, cleanup_*, recompute_all_room_ratings,
 *      has_capacity_for_booking refused; anon → expire_user_* refused; guest → own expiry OK.
 *   20261024 (reviews INSERT):
 *  13. guest reviewing another user's checked-out booking refused.
 *  14. guest inserting status='approved' on their own booking refused.
 *  15. guest reviewing a booking that is not checked out refused.
 *  16. guest reviewing their own checked-out stay works once; a second review is refused.
 *
 * Prereq: migrations 20261022, 20261023 and 20261024 applied.
 * Creates three throw-away users and deletes them at the end.
 * Run: npx tsx scripts/test-security-rpc-lockdown.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!BASE || !ANON_KEY || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } }
const svc = createClient(BASE, SERVICE_KEY, noSession)

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

async function expectRefused(label: string, call: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await call
  assert(error, `${label} succeeded — expected permission denied`)
  assert(/permission denied/i.test(error.message), `${label}: unexpected error "${error.message}"`)
}

async function expectDenied(label: string, call: PromiseLike<{ error: { message: string } | null }>, re: RegExp) {
  const { error } = await call
  assert(error, `${label} succeeded — expected refusal`)
  assert(re.test(error.message), `${label}: unexpected error "${error.message}"`)
}

async function createSignedInUser(label: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `sec-${label}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const password = `Sec!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`createUser: ${error?.message ?? 'no user'}`)
  const client = createClient(BASE, ANON_KEY, noSession)
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`)
  return { id: data.user.id, client }
}

async function main() {
  const users: string[] = []
  const slides: string[] = []
  try {
    const { data: room } = await svc.from('room_types').select('id').eq('is_active', true).limit(1).single()
    assert(room, 'no active room type')

    const guest = await createSignedInUser('guest')
    users.push(guest.id)
    const other = await createSignedInUser('other')
    users.push(other.id)

    const inMonth = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10)
    const nextDay = new Date(Date.now() + 201 * 86_400_000).toISOString().slice(0, 10)

    await step('1. guest → create_booking refused', () =>
      expectRefused('create_booking', guest.client.rpc('create_booking', {
        p_user_id: guest.id, p_room_type_id: room.id, p_check_in: inMonth, p_check_out: nextDay,
        p_guests: 1, p_nights: 1, p_base_subtotal: 1, p_discount_total: 0, p_tax_total: 0,
        p_fee_total: 0, p_total: 1, p_currency: 'THB', p_promotion_id: null,
        p_cancellation_policy_id: null, p_booker_full_name: 'Sec Test', p_booker_email: 'x@example.com',
        p_booker_phone: '0812345678', p_special_request: null, p_channel: 'walk_in',
        p_booking_code: 'ZZR-SEC01',
      })))

    await step('2. guest → create_temp_booking refused', () =>
      expectRefused('create_temp_booking', guest.client.rpc('create_temp_booking', {
        p_user_id: guest.id, p_room_type_id: room.id, p_check_in: inMonth, p_check_out: nextDay,
        p_guests: 1, p_nights: 1, p_base_subtotal: 1, p_total: 1, p_booker_full_name: 'Sec Test',
        p_booker_email: 'x@example.com', p_booker_phone: '0812345678', p_hold_minutes: 30000,
      })))

    await step('3. guest → complete_temp_booking refused', () =>
      expectRefused('complete_temp_booking', guest.client.rpc('complete_temp_booking', {
        p_booking_id: '00000000-0000-0000-0000-000000000000', p_user_id: guest.id,
        p_booker_full_name: 'Sec Test', p_booker_email: 'x@example.com', p_booker_phone: '0812345678',
        p_special_request: null, p_promotion_id: null, p_cancellation_policy_id: null,
        p_base_subtotal: 1, p_discount_total: 0, p_tax_total: 0, p_fee_total: 0, p_total: 1, p_nights: 1,
      })))

    await step('3b. anon → confirm_payment_session / expire_payment_session / confirm_refund_session refused', async () => {
      const anon = createClient(BASE, ANON_KEY, noSession)
      await expectRefused('confirm_payment_session', anon.rpc('confirm_payment_session', {
        p_session_id: 'cs_test_sec', p_event_id: 'evt_sec', p_payment_id: 'pi_sec',
      }))
      await expectRefused('expire_payment_session', anon.rpc('expire_payment_session', {
        p_session_id: 'cs_test_sec', p_event_id: 'evt_sec',
      }))
      await expectRefused('confirm_refund_session', guest.client.rpc('confirm_refund_session', {
        p_payment_intent: 'pi_sec', p_event_id: 'evt_sec',
      }))
    })

    await step('4. guest → get_session_email_for_user(other user) refused', () =>
      expectRefused('get_session_email_for_user', guest.client.rpc('get_session_email_for_user', { p_uid: other.id })))

    await step('5. anon → get_session_email_for_user refused', () =>
      expectRefused('get_session_email_for_user (anon)',
        createClient(BASE, ANON_KEY, noSession).rpc('get_session_email_for_user', { p_uid: other.id })))

    const anon = createClient(BASE, ANON_KEY, noSession)
    const slideArgs = {
      p_source_type: 'custom', p_room_type_id: null, p_promotion_id: null,
      p_custom_image_key: 'sec-test/none.jpg', p_custom_caption: 'sec-test', p_custom_caption_th: 'sec-test',
      p_updated_by: null,
    }
    const nilId = '00000000-0000-0000-0000-000000000000'

    await step('8. anon → append_hero_slide / move_hero_slide refused', async () => {
      await expectRefused('append_hero_slide', anon.rpc('append_hero_slide', slideArgs))
      await expectRefused('move_hero_slide', anon.rpc('move_hero_slide', { p_slide_id: nilId, p_direction: 1 }))
    })

    await step('9. guest → append_hero_slide / move_hero_slide refused', async () => {
      await expectDenied('append_hero_slide', guest.client.rpc('append_hero_slide', slideArgs), /Only admins/)
      await expectDenied('move_hero_slide', guest.client.rpc('move_hero_slide', { p_slide_id: nilId, p_direction: 1 }), /Only admins/)
    })

    const admin = await createSignedInUser('admin')
    users.push(admin.id)
    const { error: adminErr } = await svc.from('profiles').update({ role: 'admin', is_active: true }).eq('id', admin.id)
    assert(!adminErr, `promote admin: ${adminErr?.message}`)

    await step('10. active admin → append_hero_slide + move_hero_slide work', async () => {
      const { data: id, error } = await admin.client.rpc('append_hero_slide', { ...slideArgs, p_updated_by: admin.id })
      assert(!error && typeof id === 'string', `append: ${error?.message}`)
      slides.push(id)
      const { error: moveErr } = await admin.client.rpc('move_hero_slide', { p_slide_id: id, p_direction: -1 })
      assert(!moveErr, `move: ${moveErr?.message}`)
    })

    await step("11. guest → cancel_temp_booking with another user's id refused", () =>
      expectDenied('cancel_temp_booking', guest.client.rpc('cancel_temp_booking', {
        p_booking_id: nilId, p_user_id: other.id,
      }), /Not your booking/))

    await step('12. server-only RPCs refused; expiry RPCs need a signed-in user', async () => {
      for (const client of [anon, guest.client]) {
        await expectRefused('can_link_identity_by_email', client.rpc('can_link_identity_by_email', {
          p_existing_email: 'x@example.com', p_new_email_verified: true,
        }))
        await expectRefused('cleanup_abandoned_temp_bookings', client.rpc('cleanup_abandoned_temp_bookings'))
        await expectRefused('cleanup_abandoned_unpaid_bookings', client.rpc('cleanup_abandoned_unpaid_bookings'))
        await expectRefused('recompute_all_room_ratings', client.rpc('recompute_all_room_ratings'))
        await expectRefused('has_capacity_for_booking', client.rpc('has_capacity_for_booking', { p_booking_id: nilId }))
      }
      await expectRefused('expire_user_temp_bookings (anon)', anon.rpc('expire_user_temp_bookings', { p_user_id: guest.id }))
      await expectRefused('expire_specific_unpaid_booking (anon)', anon.rpc('expire_specific_unpaid_booking', {
        p_booking_id: nilId, p_user_id: guest.id,
      }))
      const own = await guest.client.rpc('expire_user_temp_bookings', { p_user_id: guest.id })
      assert(!own.error, `guest expire_user_temp_bookings: ${own.error?.message}`)
    })

    // Reviews: one checked-out stay each for guest + other, one confirmed stay for guest.
    const stay = async (userId: string, offset: number, checkedOut: boolean) => {
      const d1 = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
      const d2 = new Date(Date.now() + (offset + 1) * 86_400_000).toISOString().slice(0, 10)
      const code = 'ZZR-' + Math.random().toString(36).slice(2, 7).toUpperCase()
      const { data: id, error } = await svc.rpc('create_booking', {
        p_user_id: userId, p_room_type_id: room.id, p_check_in: d1, p_check_out: d2,
        p_guests: 1, p_nights: 1, p_base_subtotal: 1, p_discount_total: 0, p_tax_total: 0,
        p_fee_total: 0, p_total: 1, p_currency: 'THB', p_promotion_id: null,
        p_cancellation_policy_id: null, p_booker_full_name: 'Sec Test', p_booker_email: 'sec-test@example.com',
        p_booker_phone: '0812345678', p_special_request: null, p_channel: 'walk_in', p_booking_code: code,
      })
      assert(!error && typeof id === 'string', `create_booking: ${error?.message}`)
      if (checkedOut) {
        const { error: e } = await svc.from('bookings').update({ status: 'checked_out' }).eq('id', id)
        assert(!e, `check out: ${e?.message}`)
      }
      return id as string
    }
    const guestStay = await stay(guest.id, 300, true)
    const otherStay = await stay(other.id, 302, true)
    const guestOpen = await stay(guest.id, 304, false)
    const review = (bookingId: string, extra: Record<string, unknown> = {}) =>
      guest.client.from('reviews').insert({
        user_id: guest.id, room_type_id: room.id, booking_id: bookingId, rating: 5, title: 'sec-test', ...extra,
      }).select('id')
    const rls = /row-level security/i

    await step("13. guest → review of another user's booking refused", async () => {
      const { error } = await review(otherStay)
      assert(error && rls.test(error.message), `expected RLS refusal, got ${error?.message ?? 'success'}`)
    })

    await step("14. guest → status='approved' on own stay refused", async () => {
      const { error } = await review(guestStay, { status: 'approved' })
      assert(error && rls.test(error.message), `expected RLS refusal, got ${error?.message ?? 'success'}`)
    })

    await step('15. guest → review of a stay not checked out refused', async () => {
      const { error } = await review(guestOpen)
      assert(error && rls.test(error.message), `expected RLS refusal, got ${error?.message ?? 'success'}`)
    })

    await step('16. guest → own checked-out stay works once, second refused', async () => {
      const first = await review(guestStay)
      assert(!first.error, `first review: ${first.error?.message}`)
      const second = await review(guestStay)
      assert(second.error, 'second review succeeded')
    })

    // Promote `other` to reception; the JWT stays the same throughout.
    const { error: roleErr } = await svc.from('profiles').update({ role: 'reception', is_active: true }).eq('id', other.id)
    assert(!roleErr, `promote: ${roleErr?.message}`)

    await step('6. active reception → is_staff() + has_role(reception) true', async () => {
      const [staff, role] = await Promise.all([
        other.client.rpc('is_staff'),
        other.client.rpc('has_role', { check_role: 'reception' }),
      ])
      assert(staff.data === true, `is_staff() = ${JSON.stringify(staff.data)} ${staff.error?.message ?? ''}`)
      assert(role.data === true, `has_role = ${JSON.stringify(role.data)} ${role.error?.message ?? ''}`)
    })

    const { error: offErr } = await svc.from('profiles').update({ is_active: false }).eq('id', other.id)
    assert(!offErr, `deactivate: ${offErr?.message}`)

    await step('7. deactivated reception (same JWT) → is_staff() + has_role(reception) false', async () => {
      const [staff, role] = await Promise.all([
        other.client.rpc('is_staff'),
        other.client.rpc('has_role', { check_role: 'reception' }),
      ])
      assert(staff.data === false, `is_staff() = ${JSON.stringify(staff.data)} ${staff.error?.message ?? ''}`)
      assert(role.data === false, `has_role = ${JSON.stringify(role.data)} ${role.error?.message ?? ''}`)
    })
  } finally {
    // By caption too: a refused call that wrongly succeeded leaves a slide behind.
    await svc.from('hero_slides').delete().or(`custom_caption.eq.sec-test${slides.length ? `,id.in.(${slides.join(',')})` : ''}`)
    for (const id of users) {
      await svc.from('reviews').delete().eq('user_id', id)
      const { data: own } = await svc.from('bookings').select('id').eq('user_id', id)
      const ids = (own ?? []).map((b) => b.id)
      if (ids.length) {
        await svc.from('booking_events').delete().in('booking_id', ids)
        await svc.from('email_log').delete().in('booking_id', ids)
        await svc.from('notifications').delete().in('booking_id', ids)
      }
      await svc.from('bookings').delete().eq('user_id', id)
      await svc.auth.admin.deleteUser(id)
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
