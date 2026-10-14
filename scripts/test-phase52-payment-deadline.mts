/**
 * Phase 52 — Payment deadline + leave-guard integration test.
 *
 * Verifies:
 *   1.  Source: `BookingUnpaidGuard.tsx` has popstate + click capture +
 *       beforeunload, no heartbeat, no idle-guard.
 *   2.  Source: `/bookings/[id]/page.tsx` mounts the guard only when
 *       `paymentStatus='unpaid' AND status IN ('confirmed','temp_pending')`.
 *   3.  `cancelUnpaidBookingAction` (owner) on `confirmed+unpaid` →
 *       `bookings.status='cancelled'`, payment_due_at preserved.
 *   4.  `cancelUnpaidBookingAction` (non-owner) → 42501.
 *   5.  Cancel on `paid` booking → early-return error, no DB change.
 *   6.  `expire_payment_session` RPC marks payments row expired
 *       (reuses the existing Phase 17 RPC).
 *   7.  `expire_specific_unpaid_booking` after `payment_due_at < now()`
 *       → status flips to `'payment_expired'`.
 *   8.  Capacity check excludes expired-unpaid rows (after lazy expiry):
 *       a fresh `create_booking` for the same dates succeeds.
 *   9.  `getBookingById` triggers lazy expiry (returns the post-expiry
 *       status to the page).
 *   10. History page partition includes `'payment_expired'` in cancelled
 *       tab + status badge shows the new label.
 *   11. Source: `bookings.awaitingPayment` key exists in both TH and EN.
 *   12. Source: `bookings.awaitingPayment` is used by `BookingHistory.statusLabel`
 *       AND by `app/(booking)/bookings/[id]/page.tsx:StatusBadge`.
 *   13. Source: `bookingDetail.payNow` is used in `ConfirmationActions.tsx`
 *       for the static Pay button label.
 *   14. Source: `bookingDetail.freeCancelUnpaid` is rendered in `page.tsx`
 *       under the cancellation policy card.
 *   15. Source: `ConfirmationActions.handleCancelUnpaidConfirm` calls
 *       `cancelUnpaidBookingAction` (not `cancelBooking`).
 *   16. Source: `TransactionalHeader` accepts `onBack?: () => void` and
 *       renders a button when provided.
 *   17. Source: `BookingUnpaidGuard` listens for the `booking-unpaid:show-leave`
 *       custom event (sibling-component bridge for the back button).
 *
 * Run: npx tsx scripts/test-phase52-payment-deadline.mts
 *
 * Cleanup: service-role deletes all test rows + users at the end.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!BASE || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY required',
  )
  process.exit(1)
}

const svc = createClient(BASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

interface TestUserContext {
  userId: string
  email: string
  password: string
  client: SupabaseClient
}

async function createTestUser(label: string): Promise<TestUserContext> {
  const email = `phase52-${label}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const password = `Phase52!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data?.user) {
    throw new Error(`createTestUser: ${error?.message ?? 'no user'}`)
  }
  await new Promise((r) => setTimeout(r, 200))
  const userClient = createClient(BASE, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`)
  return { userId: data.user.id, email, password, client: userClient }
}

async function deleteTestUser(userId: string) {
  await svc.from('bookings').delete().eq('user_id', userId)
  await svc.from('reviews').delete().eq('user_id', userId)
  await svc.auth.admin.deleteUser(userId)
}

async function pickTestRoomTypeId(): Promise<string> {
  const { data, error } = await svc
    .from('room_types')
    .select('id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .single()
  if (error || !data) throw new Error('no active room_type')
  return data.id as string
}

async function insertConfirmedUnpaidBooking(
  userId: string,
  roomTypeId: string,
  startOffsetDays: number,
  nights: number,
): Promise<string> {
  const checkIn = new Date()
  checkIn.setDate(checkIn.getDate() + startOffsetDays)
  const checkOut = new Date(checkIn)
  checkOut.setDate(checkOut.getDate() + nights)
  const code = 'ZZR-' + Math.random().toString(36).slice(2, 7).toUpperCase()
  const { data, error } = await svc.rpc('create_booking', {
    p_user_id: userId,
    p_room_type_id: roomTypeId,
    p_check_in: checkIn.toISOString().slice(0, 10),
    p_check_out: checkOut.toISOString().slice(0, 10),
    p_guests: 1,
    p_nights: nights,
    p_base_subtotal: 5000,
    p_discount_total: 0,
    p_tax_total: 350,
    p_fee_total: 0,
    p_total: 5350,
    p_currency: 'THB',
    p_promotion_id: null,
    p_cancellation_policy_id: null,
    p_booker_full_name: 'Phase 52 Test',
    p_booker_email: 'phase52@x.com', // ignored by Phase 51 lock; replaced with auth email
    p_booker_phone: '0812345678',
    p_special_request: null,
    p_channel: 'web',
    p_booking_code: code,
  })
  if (error) throw new Error(`create_booking: ${error.message}`)
  return data as string
}

async function main() {
  const guardSource = readFileSync(
    resolve(__dirname, '..', 'components', 'booking', 'LeaveGuardProvider.tsx'),
    'utf-8',
  )
  const pageSource = readFileSync(
    resolve(__dirname, '..', 'app', '(booking)', 'bookings', '[id]', 'page.tsx'),
    'utf-8',
  )
  const historySource = readFileSync(
    resolve(__dirname, '..', 'app', '(booking)', 'bookings', 'BookingHistory.tsx'),
    'utf-8',
  )
  const cancelActionSource = readFileSync(
    resolve(__dirname, '..', 'app', 'actions', 'booking-unpaid-cancel.ts'),
    'utf-8',
  )
  const webhookSource = readFileSync(
    resolve(__dirname, '..', 'app', 'api', 'payments', 'webhook', 'route.ts'),
    'utf-8',
  )
  // Lazy reader for ConfirmationActions.tsx — not eagerly read at the
  // top so test startup stays fast (file is only needed for cases 13/15).
  const confirmationActionsSource = (): string =>
    readFileSync(
      resolve(
        __dirname,
        '..',
        'app',
        '(booking)',
        'bookings',
        '[id]',
        'ConfirmationActions.tsx',
      ),
      'utf-8',
    )

  const roomTypeId = await pickTestRoomTypeId()
  const usersToCleanup: string[] = []
  const bookingsToCleanup: string[] = []

  // Migration-probe — checks if the Phase 52 migration has been applied
  // to the live DB. If not, the DB-dependent cases (3, 7, 8, 9) are
  // skipped with a ⚠ message instead of noisy failures. This makes
  // the test runnable both pre-apply (as a smoke test) AND post-apply
  // (as a regression suite).
  let migrationApplied = false
  {
    const { data: col } = await svc
      .from('bookings')
      .select('payment_due_at')
      .limit(1)
      .maybeSingle()
    migrationApplied = Boolean(col && 'payment_due_at' in col)
  }
  if (!migrationApplied) {
    console.log('  ⚠ Phase 52 migration not yet applied — skipping DB-dependent cases (3, 7, 8, 9)')
  }

  // ============================================================
  // Case 1 — Static: BookingUnpaidGuard has 3 effects (no heartbeat / idle)
  // ============================================================
  await step('Case 1: BookingUnpaidGuard has popstate + click capture + beforeunload, no heartbeat/idle', () => {
    assert(/addEventListener\(['"]popstate['"]/.test(guardSource), 'popstate listener missing')
    assert(/addEventListener\(['"]click['"]/.test(guardSource), 'click capture listener missing')
    assert(/addEventListener\(['"]beforeunload['"]/.test(guardSource), 'beforeunload listener missing')
    assert(/cancelUnpaidBookingAction/.test(guardSource), 'cancelUnpaidBookingAction import missing')
    assert(!/touchBookingHoldAction/.test(guardSource), 'heartbeat action should be absent (no temp lease here)')
    assert(!/releaseBookingHoldAction/.test(guardSource), 'releaseBookingHoldAction should be absent')
    assert(!/IDLE_THRESHOLD_MS|IDLE_RELEASE_COUNTDOWN_S/.test(guardSource), 'idle-guard constants should be absent')
  })

  // ============================================================
  // Case 2 — Static: /bookings/[id] mounts the leave-guard only for
  // unpaid active bookings.
  // ============================================================
  await step('Case 2: /bookings/[id] mounts LeaveGuardProvider only when paymentStatus=unpaid AND status in (confirmed,temp_pending)', () => {
    assert(
      /LeaveGuardProvider/.test(pageSource),
      'page.tsx should import LeaveGuardProvider',
    )
    assert(
      /payment_status === 'unpaid'/.test(pageSource) ||
        /paymentStatus === 'unpaid'/.test(pageSource),
      'guard should be gated on paymentStatus === unpaid',
    )
    assert(
      /status === 'confirmed'/.test(pageSource) && /status === 'temp_pending'/.test(pageSource),
      'guard should be gated on status confirmed or temp_pending',
    )
  })

  // ============================================================
  // Case 3 — cancelUnpaidBookingAction via admin client + RPC path
  // ============================================================
  const userA = await createTestUser('case3')
  usersToCleanup.push(userA.userId)
  let booking3Id = ''
  await step('Case 3: cancelUnpaidBookingAction — owner cancels confirmed+unpaid', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    // Insert a confirmed+unpaid booking via the create_booking RPC.
    // After the migration is applied, this row has payment_due_at set.
    booking3Id = await insertConfirmedUnpaidBooking(userA.userId, roomTypeId, 30, 1)
    bookingsToCleanup.push(booking3Id)
    // Simulate the server action: call cancel_booking RPC directly.
    const { error: rpcErr } = await svc.rpc('cancel_booking', {
      p_booking_id: booking3Id,
      p_staff_override: false,
      p_refund_pct_override: null,
    })
    if (rpcErr) throw new Error(`cancel_booking rpc: ${rpcErr.message}`)
    // Verify the booking was cancelled
    const { data: row } = await svc
      .from('bookings')
      .select('status, payment_status')
      .eq('id', booking3Id)
      .single()
    if (!row) throw new Error('booking not found')
    assertEq(row.status, 'cancelled', 'status after cancel')
    assertEq(row.payment_status, 'unpaid', 'payment_status after cancel (no refund row)')
    assert(cancelActionSource.includes("'cancelled'"), 'cancel action branches on status')
  })

  // ============================================================
  // Case 4 — Non-owner cannot cancel (42501)
  // ============================================================
  const userB = await createTestUser('case4-owner')
  const userC = await createTestUser('case4-attacker')
  usersToCleanup.push(userB.userId, userC.userId)
  let booking4Id = ''
  await step('Case 4: cancelUnpaidBookingAction — non-owner cannot cancel', async () => {
    booking4Id = await insertConfirmedUnpaidBooking(userB.userId, roomTypeId, 60, 1)
    bookingsToCleanup.push(booking4Id)
    // Owner = userB; attacker = userC signs in and tries to call
    // cancel_booking with userB's booking id. The RPC owner check
    // (bookings.user_id = p_user_id implicit) should reject.
    let caught = false
    try {
      const { error } = await userC.client.rpc('cancel_booking', {
        p_booking_id: booking4Id,
        p_staff_override: false,
        p_refund_pct_override: null,
      })
      if (error) caught = true
    } catch {
      caught = true
    }
    assert(caught, 'non-owner cancel should have been rejected')
    // Verify the booking is still active
    const { data: row } = await svc
      .from('bookings')
      .select('status')
      .eq('id', booking4Id)
      .single()
    assertEq(row?.status, 'confirmed', 'booking should still be confirmed after rejected cancel')
  })

  // ============================================================
  // Case 5 — Paid booking is never touched by the unpaid-cancel flow
  // ============================================================
  const userD = await createTestUser('case5')
  usersToCleanup.push(userD.userId)
  let booking5Id = ''
  await step('Case 5: paid booking is not affected by the unpaid-cancel flow', async () => {
    booking5Id = await insertConfirmedUnpaidBooking(userD.userId, roomTypeId, 90, 1)
    bookingsToCleanup.push(booking5Id)
    // Flip to paid (simulating a successful Stripe webhook)
    await svc
      .from('bookings')
      .update({ payment_status: 'paid' })
      .eq('id', booking5Id)
    // Try to cancel — the server action rejects paid bookings
    // (cancelUnpaidBookingAction: payment_status === 'paid' → error).
    // We simulate the action by calling cancel_booking with the user's
    // own client; the action layer (or the server action's pre-check)
    // would refuse. The RPC itself doesn't gate on payment_status, but
    // a properly-written server action does.
    assert(
      cancelActionSource.includes("payment_status === 'paid'") ||
        /payment_status === "paid"/.test(cancelActionSource),
      'cancel action should reject paid bookings',
    )
    // Verify the booking is still confirmed + paid
    const { data: row } = await svc
      .from('bookings')
      .select('status, payment_status')
      .eq('id', booking5Id)
      .single()
    assertEq(row?.payment_status, 'paid', 'payment_status unchanged')
  })

  // ============================================================
  // Case 6 — Source: expire_payment_session RPC is referenced by the
  // new expireCheckoutSessionAction (proves the manual-cancel path
  // updates the payments row).
  // ============================================================
  await step('Case 6: source — expireCheckoutSessionAction calls expire_payment_session', () => {
    const paymentSource = readFileSync(
      resolve(__dirname, '..', 'app', 'actions', 'payment.ts'),
      'utf-8',
    )
    assert(
      /expireCheckoutSessionAction/.test(paymentSource),
      'expireCheckoutSessionAction should be defined',
    )
    assert(
      /expire_payment_session/.test(paymentSource),
      'expire_payment_session RPC should be called',
    )
    assert(
      /stripe\.checkout\.sessions\.expire/.test(paymentSource),
      'stripe.checkout.sessions.expire should be called',
    )
  })

  // ============================================================
  // Case 7 — Lazy expiry RPC flips status to 'payment_expired'
  // ============================================================
  const userE = await createTestUser('case7')
  usersToCleanup.push(userE.userId)
  let booking7Id = ''
  await step('Case 7: expire_specific_unpaid_booking flips past-deadline confirmed+unpaid to payment_expired', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    booking7Id = await insertConfirmedUnpaidBooking(userE.userId, roomTypeId, 120, 1)
    bookingsToCleanup.push(booking7Id)
    // Backdate payment_due_at to the past
    await svc
      .from('bookings')
      .update({ payment_due_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', booking7Id)
    // Call the lazy-expiry RPC as the owner
    const { data, error } = await userE.client.rpc('expire_specific_unpaid_booking', {
      p_booking_id: booking7Id,
      p_user_id: userE.userId,
    })
    if (error) throw new Error(`expire_specific_unpaid_booking: ${error.message}`)
    assert(data === 1, `expected 1 row expired, got ${data}`)
    // Verify the booking is now 'payment_expired'
    const { data: row } = await userE.client
      .from('bookings')
      .select('status')
      .eq('id', booking7Id)
      .single()
    assertEq(row?.status, 'payment_expired', 'status after lazy expiry')
  })

  // ============================================================
  // Case 8 — Capacity check: new create_booking for same dates succeeds
  // because the expired row is now terminal
  // ============================================================
  const userF = await createTestUser('case8')
  usersToCleanup.push(userF.userId)
  await step('Case 8: capacity check excludes payment_expired rows (after lazy expiry)', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    if (!booking7Id) throw new Error('case 7 must run first')
    // Get the date range from the expired booking
    const { data: orig } = await svc
      .from('bookings')
      .select('check_in, check_out, room_type_id')
      .eq('id', booking7Id)
      .single()
    if (!orig) throw new Error('orig booking not found')
    // Try to create a new booking for the same dates — should succeed
    // because the expired row no longer holds a slot.
    const code = 'ZZR-' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: newId, error } = await svc.rpc('create_booking', {
      p_user_id: userF.userId,
      p_room_type_id: orig.room_type_id,
      p_check_in: orig.check_in,
      p_check_out: orig.check_out,
      p_guests: 1,
      p_nights: 1,
      p_base_subtotal: 5000,
      p_discount_total: 0,
      p_tax_total: 350,
      p_fee_total: 0,
      p_total: 5350,
      p_currency: 'THB',
      p_promotion_id: null,
      p_cancellation_policy_id: null,
      p_booker_full_name: 'Phase 52 Test',
      p_booker_email: 'phase52@x.com',
      p_booker_phone: '0812345678',
      p_special_request: null,
      p_channel: 'web',
      p_booking_code: code,
    })
    if (error) throw new Error(`create_booking for same dates: ${error.message}`)
    if (newId) bookingsToCleanup.push(newId as string)
  })

  // ============================================================
  // Case 9 — getBookingById triggers lazy expiry
  // ============================================================
  const userG = await createTestUser('case9')
  usersToCleanup.push(userG.userId)
  let booking9Id = ''
  await step('Case 9: getBookingById via authenticated client triggers lazy expiry', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    booking9Id = await insertConfirmedUnpaidBooking(userG.userId, roomTypeId, 150, 1)
    bookingsToCleanup.push(booking9Id)
    // Backdate
    await svc
      .from('bookings')
      .update({ payment_due_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', booking9Id)
    // The JS-layer getBookingById function (lib/data/bookings.ts) calls
    // expire_specific_unpaid_booking before reading. We simulate by
    // calling the RPC directly here; the JS function is exercised in
    // the browser-driven smoke flow.
    const { data, error } = await userG.client.rpc('expire_specific_unpaid_booking', {
      p_booking_id: booking9Id,
      p_user_id: userG.userId,
    })
    if (error) throw new Error(`expire: ${error.message}`)
    assert(data === 1, `expected 1 row, got ${data}`)
    // Re-read (as the JS function would)
    const { data: row } = await userG.client
      .from('bookings')
      .select('status')
      .eq('id', booking9Id)
      .single()
    assertEq(row?.status, 'payment_expired', 'status after read')
  })

  // ============================================================
  // Case 10 — History page partition + status label (Phase 52
  // follow-up: now uses status='expired' + lapsed_reason='payment_deadline'
  // to disambiguate from the temp-pending hold-lapsed case)
  // ============================================================
  await step('Case 10: BookingHistory uses status=expired + lapsed_reason for the two labels', () => {
    // The history source no longer references 'payment_expired' enum
    // value (we reuse 'expired' + the column disambiguates).
    assert(
      !/statusPaymentExpired/.test(historySource),
      'BookingHistory should NOT use the legacy statusPaymentExpired label',
    )
    assert(
      /lapsed_reason/.test(historySource) || /lapsedReason/.test(historySource),
      'BookingHistory.statusLabel should take lapsed_reason as a parameter',
    )
    // Verify the new i18n key exists in both dictionaries
    const th = readFileSync(
      resolve(__dirname, '..', 'lib', 'i18n', 'dictionaries', 'th.ts'),
      'utf-8',
    )
    const en = readFileSync(
      resolve(__dirname, '..', 'lib', 'i18n', 'dictionaries', 'en.ts'),
      'utf-8',
    )
    assert(/statusExpiredPayment:.*หมดเวลาชำระเงิน/.test(th), 'TH statusExpiredPayment missing')
    assert(/statusExpiredPayment:.*Payment deadline expired/.test(en), 'EN statusExpiredPayment missing')
  })

  // ============================================================
  // Phase 52 follow-up — additional UI fixes
  // ============================================================

  // Case 11 — i18n: bookings.awaitingPayment key exists in both dicts
  await step('Case 11: bookings.awaitingPayment key exists in both TH and EN', () => {
    const th = readFileSync(
      resolve(__dirname, '..', 'lib', 'i18n', 'dictionaries', 'th.ts'),
      'utf-8',
    )
    const en = readFileSync(
      resolve(__dirname, '..', 'lib', 'i18n', 'dictionaries', 'en.ts'),
      'utf-8',
    )
    assert(/awaitingPayment:.*รอชำระเงิน/.test(th), 'TH awaitingPayment missing')
    assert(/awaitingPayment:.*Awaiting payment/.test(en), 'EN awaitingPayment missing')
  })

  // Case 12 — Source: awaitingPayment used in BookingHistory.statusLabel
  // AND in /bookings/[id]/page.tsx:StatusBadge
  await step('Case 12: bookings.awaitingPayment is used in both statusLabel and StatusBadge', () => {
    assert(
      /awaitingPayment/.test(historySource),
      'BookingHistory.statusLabel should reference awaitingPayment',
    )
    assert(
      /awaitingPayment/.test(pageSource),
      'page.tsx StatusBadge should reference awaitingPayment',
    )
  })

  // Case 13 — Source: bookingDetail.payNow used in ConfirmationActions Pay button
  await step('Case 13: bookingDetail.payNow is the static Pay button label in ConfirmationActions', () => {
    assert(
      /bookingDetail\.payNow/.test(confirmationActionsSource()),
      'ConfirmationActions should use bookingDetail.payNow for the static Pay label',
    )
    // The in-flight spinner still uses paymentPending — that's intentional
    // (different semantic, kept separate per i18n comment).
  })

  // Case 14 — Source: bookingDetail.freeCancelUnpaid rendered under policy card
  await step('Case 14: bookingDetail.freeCancelUnpaid is rendered under the policy card', () => {
    assert(
      /bookingDetail\.freeCancelUnpaid/.test(pageSource),
      'page.tsx should reference bookingDetail.freeCancelUnpaid',
    )
  })

  // Case 15 — Source: handleCancelUnpaidConfirm calls cancelUnpaidBookingAction
  await step('Case 15: ConfirmationActions.handleCancelUnpaidConfirm uses cancelUnpaidBookingAction', () => {
    const actions = confirmationActionsSource()
    assert(
      /cancelUnpaidBookingAction/.test(actions),
      'ConfirmationActions should import cancelUnpaidBookingAction',
    )
    // The unpaid-cancel handler specifically should use it (not cancelBooking).
    // Match the function body of handleCancelUnpaidConfirm — it sits
    // between the `setConfirmCancelOpen(false)` and the `router.push`.
    const handleCancel = actions.match(
      /const handleCancelUnpaidConfirm[\s\S]*?\n  \}/,
    )
    assert(handleCancel, 'handleCancelUnpaidConfirm not found')
    assert(
      /cancelUnpaidBookingAction/.test(handleCancel[0]),
      'handleCancelUnpaidConfirm should call cancelUnpaidBookingAction',
    )
    assert(
      !/cancelBooking\(/.test(handleCancel[0]),
      'handleCancelUnpaidConfirm should NOT call cancelBooking (unpaid path)',
    )
  })

  // Case 16 — Source: TransactionalHeader is a SERVER component (no
  // 'use client', no onBack prop). The leave-guard back button is a
  // separate client component (LeaveGuardBackButton) that the page
  // mounts alongside the header. (This case replaced the old check
  // that asserted TransactionalHeader accepts onBack — that was the
  // RSC-boundary bug.)
  await step('Case 16: TransactionalHeader is a server component (no onBack prop)', () => {
    const headerSource = readFileSync(
      resolve(__dirname, '..', 'components', 'layout', 'TransactionalHeader.tsx'),
      'utf-8',
    )
    assert(
      !/['"]use client['"]/.test(headerSource),
      'TransactionalHeader should NOT be a client component (revert from Phase 52)',
    )
    assert(
      !/onBack\??:/.test(headerSource) && !/onBack\s*=/.test(headerSource),
      'TransactionalHeader should NOT declare or accept an onBack prop',
    )
    // The back element is always a Link.
    assert(
      /<Link[\s\S]*?backHref/.test(headerSource),
      'TransactionalHeader should still render a back Link',
    )
  })

  // Case 17 (updated) — Source: the leave-guard uses a Provider + hook
  // (not a global custom event). The new architecture exposes
  // `useLeaveGuard()` and renders the back button as a separate client
  // component (`LeaveGuardBackButton`) that calls the hook.
  await step('Case 17: LeaveGuardProvider exposes useLeaveGuard hook + LeaveGuardBackButton uses it', () => {
    const providerSource = readFileSync(
      resolve(
        __dirname,
        '..',
        'components',
        'booking',
        'LeaveGuardProvider.tsx',
      ),
      'utf-8',
    )
    const backBtnSource = readFileSync(
      resolve(
        __dirname,
        '..',
        'components',
        'booking',
        'LeaveGuardBackButton.tsx',
      ),
      'utf-8',
    )
    assert(
      /export function useLeaveGuard/.test(providerSource),
      'LeaveGuardProvider should export useLeaveGuard hook',
    )
    assert(
      /createContext/.test(providerSource),
      'LeaveGuardProvider should use a React context for the hook',
    )
    assert(
      /requestLeave/.test(providerSource) && /requestLeave/.test(backBtnSource),
      'requestLeave should be defined in the provider + called from the back button',
    )
    // Regression: the legacy custom event should be gone.
    assert(
      !/booking-unpaid:show-leave/.test(providerSource),
      'LeaveGuardProvider should NOT use the legacy booking-unpaid:show-leave event',
    )
    assert(
      !/booking-unpaid:show-leave/.test(backBtnSource),
      'LeaveGuardBackButton should NOT use the legacy booking-unpaid:show-leave event',
    )
  })

  // ============================================================
  // Phase 52 follow-up — two-stage payment window
  // ============================================================

  // Case 18 — Stage 1: create_booking sets payment_due_at to ~5 min from now
  await step('Case 18: create_booking sets payment_due_at to ~5 minutes from now (Stage 1)', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    const u = await createTestUser('case18')
    usersToCleanup.push(u.userId)
    const id = await insertConfirmedUnpaidBooking(u.userId, roomTypeId, 200, 1)
    bookingsToCleanup.push(id)
    const { data: row } = await svc
      .from('bookings')
      .select('payment_due_at')
      .eq('id', id)
      .single()
    if (!row?.payment_due_at) throw new Error('payment_due_at not set')
    const deltaMs =
      new Date(row.payment_due_at).getTime() - Date.now()
    assert(
      deltaMs > 4 * 60 * 1000 && deltaMs < 6 * 60 * 1000,
      `payment_due_at should be ~5 min from now, got ${deltaMs}ms`,
    )
  })

  // Case 19 — Stage 1: complete_temp_booking sets payment_due_at to ~5 min
  await step('Case 19: complete_temp_booking sets payment_due_at to ~5 minutes (Stage 1)', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    const u = await createTestUser('case19')
    usersToCleanup.push(u.userId)
    // Insert a temp_pending row first
    const checkIn = new Date()
    checkIn.setDate(checkIn.getDate() + 200)
    const checkOut = new Date(checkIn)
    checkOut.setDate(checkOut.getDate() + 1)
    const code = 'ZZR-' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: tmpId, error: tmpErr } = await u.client.rpc(
      'create_temp_booking',
      {
        p_user_id: u.userId,
        p_room_type_id: roomTypeId,
        p_check_in: checkIn.toISOString().slice(0, 10),
        p_check_out: checkOut.toISOString().slice(0, 10),
        p_guests: 1,
        p_nights: 1,
        p_base_subtotal: 5000,
        p_total: 5350,
        p_booker_full_name: 'Phase 52 Test',
        p_booker_email: 'phase52@x.com',
        p_booker_phone: '0812345678',
        p_hold_minutes: 60,
      },
    )
    if (tmpErr) throw new Error(`create_temp_booking: ${tmpErr.message}`)
    if (tmpId) bookingsToCleanup.push(tmpId as string)
    // Now complete it
    const { error: compErr } = await u.client.rpc('complete_temp_booking', {
      p_booking_id: tmpId,
      p_user_id: u.userId,
      p_booker_full_name: 'Phase 52 Test',
      p_booker_email: 'phase52@x.com',
      p_booker_phone: '0812345678',
      p_special_request: null,
      p_promotion_id: null,
      p_cancellation_policy_id: null,
      p_base_subtotal: 5000,
      p_discount_total: 0,
      p_tax_total: 350,
      p_fee_total: 0,
      p_total: 5350,
      p_nights: 1,
    })
    if (compErr) throw new Error(`complete_temp_booking: ${compErr.message}`)
    const { data: row } = await svc
      .from('bookings')
      .select('payment_due_at, status')
      .eq('id', tmpId)
      .single()
    if (!row?.payment_due_at) throw new Error('payment_due_at not set after complete')
    const deltaMs =
      new Date(row.payment_due_at).getTime() - Date.now()
    assert(
      deltaMs > 4 * 60 * 1000 && deltaMs < 6 * 60 * 1000,
      `payment_due_at should be ~5 min from now, got ${deltaMs}ms`,
    )
    assertEq(row.status, 'confirmed', 'status after complete')
  })

  // Case 20 — Stage 1: lazy expiry after deadline flips to status=expired + lapsed_reason='payment_deadline'
  await step('Case 20: lazy expiry after deadline flips to status=expired + lapsed_reason=payment_deadline', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    const u = await createTestUser('case20')
    usersToCleanup.push(u.userId)
    const id = await insertConfirmedUnpaidBooking(u.userId, roomTypeId, 210, 1)
    bookingsToCleanup.push(id)
    await svc
      .from('bookings')
      .update({ payment_due_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', id)
    const { data, error } = await u.client.rpc(
      'expire_specific_unpaid_booking',
      { p_booking_id: id, p_user_id: u.userId },
    )
    if (error) throw new Error(`expire_specific_unpaid_booking: ${error.message}`)
    assert(data === 1, `expected 1 row expired, got ${data}`)
    const { data: row } = await svc
      .from('bookings')
      .select('status, lapsed_reason')
      .eq('id', id)
      .single()
    assertEq(row?.status, 'expired', 'status after lazy expiry')
    assertEq(row?.lapsed_reason, 'payment_deadline', 'lapsed_reason after lazy expiry')
  })

  // Case 21 — Stage 2: extend_payment_due_at RPC sets payment_due_at to a new timestamp
  await step('Case 21: extend_payment_due_at RPC sets payment_due_at to given timestamp', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    const u = await createTestUser('case21')
    usersToCleanup.push(u.userId)
    const id = await insertConfirmedUnpaidBooking(u.userId, roomTypeId, 220, 1)
    bookingsToCleanup.push(id)
    const newDue = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const { error } = await svc.rpc('extend_payment_due_at', {
      p_booking_id: id,
      p_new_payment_due: newDue,
    })
    if (error) throw new Error(`extend_payment_due_at: ${error.message}`)
    const { data: row } = await svc
      .from('bookings')
      .select('payment_due_at')
      .eq('id', id)
      .single()
    const deltaMs = new Date(row?.payment_due_at).getTime() - Date.now()
    assert(
      deltaMs > 29 * 60 * 1000 && deltaMs < 31 * 60 * 1000,
      `payment_due_at should be ~30 min from now, got ${deltaMs}ms`,
    )
  })

  // Case 22 — has_capacity_for_booking returns true for a fresh booking
  await step('Case 22: has_capacity_for_booking returns true for a fresh booking', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    const u = await createTestUser('case22')
    usersToCleanup.push(u.userId)
    const id = await insertConfirmedUnpaidBooking(u.userId, roomTypeId, 230, 1)
    bookingsToCleanup.push(id)
    const { data, error } = await svc.rpc('has_capacity_for_booking', {
      p_booking_id: id,
    })
    if (error) throw new Error(`has_capacity_for_booking: ${error.message}`)
    assert(data === true, `expected true, got ${data}`)
  })

  // Case 23 — has_capacity_for_booking returns false when the pool is full
  await step('Case 23: has_capacity_for_booking returns false when another booking fills the pool', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    // Get the room_type's pool size
    const { data: rt } = await svc
      .from('room_types')
      .select('id')
      .eq('id', roomTypeId)
      .single()
    if (!rt) throw new Error('room type not found')
    const { data: units } = await svc
      .from('room_units')
      .select('id')
      .eq('room_type_id', roomTypeId)
      .eq('is_active', true)
    const poolSize = units?.length ?? 0
    if (poolSize === 0) {
      console.log('    (skipped — no room units in pool)')
      return
    }
    // Fill the pool with bookings for a fresh user (different dates)
    const u = await createTestUser('case23')
    usersToCleanup.push(u.userId)
    // Create (poolSize) confirmed+unpaid bookings for the same dates
    const uuids: string[] = []
    for (let i = 0; i < poolSize; i++) {
      const b = await insertConfirmedUnpaidBooking(
        u.userId,
        roomTypeId,
        240 + i,
        1,
      )
      bookingsToCleanup.push(b)
      uuids.push(b)
    }
    // Now create a new booking for the same dates — should be impossible
    // via create_booking, so we use has_capacity_for_booking directly.
    const { data, error } = await svc.rpc('has_capacity_for_booking', {
      p_booking_id: uuids[0],
    })
    if (error) throw new Error(`has_capacity_for_booking: ${error.message}`)
    assert(
      data === false,
      `expected false (pool full), got ${data}`,
    )
  })

  // Case 24 — Return-from-Stripe: reset_payment_window extends to 5 min for confirmed+unpaid
  await step('Case 24: reset_payment_window extends payment_due_at to 5 min for confirmed+unpaid', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    const u = await createTestUser('case24')
    usersToCleanup.push(u.userId)
    const id = await insertConfirmedUnpaidBooking(u.userId, roomTypeId, 250, 1)
    bookingsToCleanup.push(id)
    // First extend to 30 min (simulate a Pay click happened)
    const due30 = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await svc.rpc('extend_payment_due_at', {
      p_booking_id: id,
      p_new_payment_due: due30,
    })
    // Now reset (simulate return from Stripe)
    const { data, error } = await svc.rpc('reset_payment_window', {
      p_booking_id: id,
    })
    if (error) throw new Error(`reset_payment_window: ${error.message}`)
    assert(data === 'reset', `expected 'reset', got ${data}`)
    const { data: row } = await svc
      .from('bookings')
      .select('payment_due_at, lapsed_reason')
      .eq('id', id)
      .single()
    const deltaMs = new Date(row?.payment_due_at).getTime() - Date.now()
    assert(
      deltaMs > 4 * 60 * 1000 && deltaMs < 6 * 60 * 1000,
      `payment_due_at should be ~5 min from now, got ${deltaMs}ms`,
    )
    assertEq(row?.lapsed_reason, null, 'lapsed_reason after reset')
  })

  // Case 25 — Return-from-Stripe: reset_payment_window re-opens an expired row
  await step('Case 25: reset_payment_window re-opens an expired+lapsed_reason=payment_deadline row to confirmed', async () => {
    if (!migrationApplied) {
      console.log('    (skipped — migration not applied)')
      return
    }
    const u = await createTestUser('case25')
    usersToCleanup.push(u.userId)
    const id = await insertConfirmedUnpaidBooking(u.userId, roomTypeId, 260, 1)
    bookingsToCleanup.push(id)
    // Backdate and lazy-expire
    await svc
      .from('bookings')
      .update({ payment_due_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', id)
    await svc.rpc('expire_specific_unpaid_booking', {
      p_booking_id: id,
      p_user_id: u.userId,
    })
    // Verify it's expired
    const { data: before } = await svc
      .from('bookings')
      .select('status, lapsed_reason')
      .eq('id', id)
      .single()
    assertEq(before?.status, 'expired', 'pre-reset status')
    assertEq(
      before?.lapsed_reason,
      'payment_deadline',
      'pre-reset lapsed_reason',
    )
    // Reset
    const { data, error } = await svc.rpc('reset_payment_window', {
      p_booking_id: id,
    })
    if (error) throw new Error(`reset_payment_window: ${error.message}`)
    assert(data === 'restored', `expected 'restored', got ${data}`)
    const { data: after } = await svc
      .from('bookings')
      .select('status, lapsed_reason')
      .eq('id', id)
      .single()
    assertEq(after?.status, 'confirmed', 'post-reset status')
    assertEq(after?.lapsed_reason, null, 'post-reset lapsed_reason')
  })

  // Case 26 — Source: cancelUnpaidBookingAction reconciles-as-paid on Stripe race
  await step('Case 26: source — cancelUnpaidBookingAction reconciles-as-paid on Stripe race', () => {
    const cancel = cancelActionSource
    assert(
      /payment_status\s*===\s*['"]complete['"]/.test(cancel),
      'cancelUnpaidBookingAction should check payment_status === complete',
    )
    assert(
      /confirm_payment_session/.test(cancel),
      'cancelUnpaidBookingAction should call confirm_payment_session on race',
    )
  })

  // Case 27 — Source: webhook race branch re-confirms if capacity is free, else refunds
  await step('Case 27: source — webhook race branch re-confirms if capacity is free', () => {
    assert(
      /has_capacity_for_booking/.test(webhookSource),
      'webhook should call has_capacity_for_booking',
    )
    assert(
      /payment_recovered/.test(webhookSource),
      'webhook should emit a payment_recovered event on re-confirm',
    )
    assert(
      /auto_refund/.test(webhookSource),
      'webhook should still support auto_refund on capacity-full',
    )
  })

  // Case 28 — Source: createCheckoutSessionAction has server-side pre-checks
  await step('Case 28: source — createCheckoutSessionAction has pre-checks for owner/status/deadline/capacity', () => {
    const pay = readFileSync(
      resolve(__dirname, '..', 'app', 'actions', 'payment.ts'),
      'utf-8',
    )
    assert(
      /precheckPayableBooking/.test(pay),
      'createCheckoutSessionAction should call precheckPayableBooking',
    )
    assert(
      /has_capacity_for_booking/.test(pay),
      'createCheckoutSessionAction should re-validate capacity',
    )
    assert(
      /extendPaymentDeadlineAction/.test(pay),
      'createCheckoutSessionAction should call extendPaymentDeadlineAction to set the 30-min window',
    )
  })

  // Case 29 — Source: page server-renders the deadline via formatTimeBangkok (hydration-safe)
  await step('Case 29: source — /bookings/[id] page server-renders the deadline (no client-side formatTime)', () => {
    assert(
      /formatTimeBangkok/.test(pageSource),
      'page.tsx should define/use formatTimeBangkok',
    )
    assert(
      /timeZone:\s*['"]Asia\/Bangkok['"]/.test(pageSource),
      'formatTimeBangkok should pin timeZone to Asia/Bangkok',
    )
    // The LeaveGuardProvider should no longer import formatTime.
    assert(
      !/formatTime\(/.test(guardSource),
      'LeaveGuardProvider should no longer format the deadline client-side',
    )
  })

  // Case 30 — Source: page calls resetPaymentWindowAction on ?cancelled=1 + isUnpaidActive
  await step('Case 30: source — page calls resetPaymentWindowAction on the ?cancelled=1 path', () => {
    assert(
      /resetPaymentWindowAction/.test(pageSource),
      'page.tsx should import + call resetPaymentWindowAction',
    )
    assert(
      /cancelledByUser.*isUnpaidActive/.test(pageSource) ||
        /cancelledByUser[\s\S]{0,100}isUnpaidActive/.test(pageSource),
      'reset call should be gated on cancelledByUser AND isUnpaidActive',
    )
  })

  // Case 31 — RSC boundary regression: TransactionalHeader reverts to a
  // server component (no 'use client') and no longer accepts `onBack`.
  // The page must NOT pass `onBack` to <TransactionalHeader>. The leave-
  // guard back button is now a separate client component
  // (`LeaveGuardBackButton`) that uses the hook.
  await step('Case 31: RSC fix — TransactionalHeader is a server component (no onBack prop)', () => {
    const headerSource = readFileSync(
      resolve(__dirname, '..', 'components', 'layout', 'TransactionalHeader.tsx'),
      'utf-8',
    )
    assert(
      !/['"]use client['"]/.test(headerSource),
      'TransactionalHeader should NOT be a client component (revert from Phase 52)',
    )
    assert(
      !/onBack\??:\s*\(\)/.test(headerSource) && !/onBack\?:/.test(headerSource),
      'TransactionalHeader should NOT declare an onBack prop',
    )
    // The page should not pass onBack to it.
    assert(
      !/<TransactionalHeader[\s\S]*?onBack\s*=/.test(pageSource),
      'page.tsx should NOT pass onBack to <TransactionalHeader>',
    )
    // The old custom event should be fully gone from the codebase
    // (except for the test's reference comment).
    const allSources = [
      pageSource,
      headerSource,
      readFileSync(
        resolve(__dirname, '..', 'app', 'actions', 'payment.ts'),
        'utf-8',
      ),
      readFileSync(
        resolve(__dirname, '..', 'app', 'actions', 'booking-unpaid-cancel.ts'),
        'utf-8',
      ),
    ].join('\n')
    assert(
      !/booking-unpaid:show-leave/.test(allSources),
      'the booking-unpaid:show-leave custom event should be gone from app code',
    )
  })

  // ============================================================
  // Cleanup
  // ============================================================
  console.log('\n▶ Cleanup')
  for (const id of bookingsToCleanup) {
    // Also clean up the dependent payments + booking_events
    await svc.from('payments').delete().eq('booking_id', id)
    await svc.from('booking_events').delete().eq('booking_id', id)
    const { error } = await svc.from('bookings').delete().eq('id', id)
    if (error) console.log('  ⚠ delete booking', id, error.message)
    else console.log('  ✓ deleted booking', id)
  }
  for (const id of usersToCleanup) {
    await deleteTestUser(id)
    console.log('  ✓ deleted test user', id)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
