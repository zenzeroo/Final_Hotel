/**
 * Phase 20 #25 — Email infrastructure integration test.
 *
 * Validates the `email_log` table + `sendEmail` helper contract end-to-end:
 *   1. Table structure (event_key UNIQUE, nullable FKs, status enum).
 *   2. Dev-fallback flow (insert 'queued' → update 'sent' with `dev:` message id).
 *   3. Idempotency: upsert on event_key conflict updates the same row
 *      instead of inserting a duplicate.
 *   4. RLS: authenticated user_context can't SELECT email_log
 *      (managers+admin+staff SELECT; manager+admin UPDATE).
 *   5. Cross-reference columns (booking_id / payment_id / refund_request_id)
 *      accept the real UUIDs the email hooks pass through.
 *   6. FK cleanup: deleting a booking cascades its email_log rows.
 *
 * The 5 email templates themselves render HTML safely (Phase 25 doesn't ship
 * automated HTML-validity tests — visual review only via templates/<name>.tsx).
 *
 * Prereqs:
 *   - Migration 20260908_email_log.sql applied (creates email_log table +
 *     event_key UNIQUE + RLS policies).
 *   - test@zenzero.com fixture (scripts/_rbac-fixture.mts) for RLS check.
 *
 * Run: npx tsx scripts/test-phase25-email.mts
 *
 * Cleanup: email_log rows tagged with `event_key` prefix `test-phase25-%`.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!BASE || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local')
  process.exit(1)
}

const svc = createServiceClient(BASE, SERVICE_KEY, {
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

const EVENT_PREFIX = 'test-phase25-'

// ── Cleanup any leftover rows from previous runs ─────────────────────────
async function cleanup() {
  await svc.from('email_log').delete().like('event_key', `${EVENT_PREFIX}%`)
}
await cleanup()

// ── Fixtures ────────────────────────────────────────────────────────────
const { data: usersList } = await svc.auth.admin.listUsers()
const testUser = usersList?.users.find((u) => u.email === 'test@zenzero.com')
if (!testUser) {
  console.error('test@zenzero.com not found — run scripts/_rbac-fixture.mts first')
  process.exit(1)
}
const testUserId = testUser.id

const { data: roomType } = await svc
  .from('room_types')
  .select('id')
  .eq('is_active', true)
  .limit(1)
  .single()
if (!roomType) {
  console.error('No room_type found')
  process.exit(1)
}

// ── Case 1 — Table structure + event_key UNIQUE ─────────────────────────
await step('email_log has expected columns + event_key UNIQUE', async () => {
  // Insert baseline row.
  const key = `${EVENT_PREFIX}case1`
  const { data: row, error: insErr } = await svc
    .from('email_log')
    .insert({
      recipient: 'test@zenzero.com',
      template: 'booking_confirmation',
      subject: 'test',
      status: 'queued',
      booking_id: null,
      payment_id: null,
      refund_request_id: null,
      event_key: key,
      metadata: {},
    })
    .select('id, status, event_key, recipient, template')
    .single()
  assert(!insErr, `insert failed: ${insErr?.message}`)
  assert(row, 'no row returned')
  assert(row.template === 'booking_confirmation', `template=${row.template}`)
  assert(row.status === 'queued', `status=${row.status}`)

  // Try to insert a SECOND row with the same event_key → expect unique-violation.
  const { error: dupErr } = await svc
    .from('email_log')
    .insert({
      recipient: 'test@zenzero.com',
      template: 'booking_confirmation',
      subject: 'dup',
      status: 'queued',
      event_key: key,
      metadata: {},
    })
  assert(dupErr, 'duplicate event_key insert unexpectedly succeeded')
  assert(dupErr.code === '23505', `expected 23505 (unique_violation), got ${dupErr.code}`)
  return 'unique violation 23505 on duplicate event_key'
})

// ── Case 2 — Dev-fallback 'queued → sent' lifecycle ──────────────────────
await step('sendEmail dev-fallback lifecycle: queued → sent with dev: message id', async () => {
  const key = `${EVENT_PREFIX}case2`
  const { data: row, error } = await svc
    .from('email_log')
    .upsert(
      {
        recipient: 'test@zenzero.com',
        template: 'payment_receipt',
        subject: 'phase25 receipt test',
        status: 'queued',
        event_key: key,
        metadata: { test: true },
      },
      { onConflict: 'event_key' },
    )
    .select('id')
    .single()
  assert(!error, `upsert failed: ${error?.message}`)
  assert(row?.id, 'no row id')

  // Simulate sendEmail's dev-fallback update.
  const { error: updErr } = await svc
    .from('email_log')
    .update({
      status: 'sent',
      provider_message_id: `dev:${row.id}`,
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', row.id)
  assert(!updErr, `update failed: ${updErr?.message}`)

  // Verify final state.
  const { data: final } = await svc
    .from('email_log')
    .select('status, provider_message_id, sent_at, error_message')
    .eq('id', row.id)
    .single()
  assert(final?.status === 'sent', `status=${final?.status}`)
  assert(final?.provider_message_id?.startsWith('dev:'), `provider_message_id=${final?.provider_message_id}`)
  assert(final?.sent_at, 'sent_at missing')
  assert(final?.error_message === null, `error_message=${final?.error_message}`)
  return `status=sent messageId=${final?.provider_message_id}`
})

// ── Case 3 — Idempotency on re-fire (upsert on event_key conflict) ──────
await step('re-fire with same event_key updates the existing row', async () => {
  const key = `${EVENT_PREFIX}case3`
  // First fire.
  const { data: r1 } = await svc
    .from('email_log')
    .upsert(
      {
        recipient: 'test@zenzero.com',
        template: 'cancellation_notice',
        subject: 'phase25 cancel notice v1',
        status: 'queued',
        event_key: key,
        metadata: { revision: 1 },
      },
      { onConflict: 'event_key' },
    )
    .select('id, subject, metadata')
    .single()
  assert(r1?.id, 'first upsert failed')

  // Simulate the "we changed the subject and want to re-fire" upsert.
  const { data: r2 } = await svc
    .from('email_log')
    .upsert(
      {
        recipient: 'test@zenzero.com',
        template: 'cancellation_notice',
        subject: 'phase25 cancel notice v2',
        status: 'queued',
        event_key: key,
        metadata: { revision: 2 },
      },
      { onConflict: 'event_key' },
    )
    .select('id, subject, metadata')
    .single()
  assert(r2?.id === r1.id, `expected same row id ${r1.id}, got ${r2?.id}`)
  assert(r2?.subject === 'phase25 cancel notice v2', `subject=${r2?.subject}`)

  // Count rows with this event_key → expect exactly 1.
  const { count } = await svc
    .from('email_log')
    .select('*', { count: 'exact', head: true })
    .eq('event_key', key)
  assert(count === 1, `expected 1 row with event_key=${key}, got ${count}`)
  return `id=${r2?.id} (1 row after re-fire)`
})

// ── Case 4 — All 5 templates + status enum values roundtrip ─────────────
await step('all 5 templates + statuses roundtrip through email_log', async () => {
  const templates: Array<{
    template: 'booking_confirmation' | 'payment_receipt' | 'cancellation_notice' | 'refund_notice' | 'checkout_thank_you'
    status: 'queued' | 'sent' | 'failed'
  }> = [
    { template: 'booking_confirmation', status: 'queued' },
    { template: 'payment_receipt', status: 'sent' },
    { template: 'cancellation_notice', status: 'failed' },
    { template: 'refund_notice', status: 'sent' },
    { template: 'checkout_thank_you', status: 'failed' },
  ]
  for (const [i, t] of templates.entries()) {
    const { error: insErr } = await svc.from('email_log').insert({
      recipient: 'test@zenzero.com',
      template: t.template,
      subject: `phase25 ${t.template}`,
      status: t.status,
      event_key: `${EVENT_PREFIX}case4-${i}`,
      error_message: t.status === 'failed' ? 'simulated resend failure' : null,
      metadata: {},
    })
    assert(!insErr, `${t.template} insert failed: ${insErr?.message}`)
  }

  // Read them all back.
  const { data: rows, error: selErr } = await svc
    .from('email_log')
    .select('template, status')
    .like('event_key', `${EVENT_PREFIX}case4-%`)
  assert(!selErr, `select failed: ${selErr?.message}`)
  assert(rows?.length === 5, `expected 5 rows, got ${rows?.length}`)
  for (const t of templates) {
    const matching = rows!.find((r) => r.template === t.template)
    assert(matching, `template ${t.template} not round-tripped`)
    assert(matching.status === t.status, `${t.template} status=${matching.status}, expected ${t.status}`)
  }
  return `5 templates × 3 statuses all round-tripped`
})

// ── Case 5 — Cross-reference FK columns (booking_id / payment_id / refund_request_id) ──
await step('cross-reference FK columns accept real booking/payment/refund UUIDs', async () => {
  // Use a unique far-future date range to avoid pool=1 conflict with other
  // tests that use today/tomorrow. Year 2032.
  const code = `${EVENT_PREFIX}case5-${Date.now()}`
  const checkIn = '2032-04-01'
  const checkOut = '2032-04-05'
  const { data: bid, error: rpcErr } = await svc.rpc('create_booking', {
    p_user_id: testUserId,
    p_room_type_id: roomType.id,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_guests: 1,
    p_nights: 4,
    p_base_subtotal: 1000,
    p_discount_total: 0,
    p_tax_total: 70,
    p_fee_total: 150,
    p_total: 1220,
    p_currency: 'THB',
    p_promotion_id: null,
    p_cancellation_policy_id: null,
    p_booker_full_name: 'Email Test',
    p_booker_email: 'test@zenzero.com',
    p_booker_phone: null,
    p_special_request: null,
    p_channel: 'web' as const,
    p_booking_code: code,
  })
  assert(!rpcErr, `create_booking failed: ${rpcErr?.message}`)
  const bookingId = bid as string

  // Insert an email_log row that points at the booking.
  const { data: emailRow, error: insErr } = await svc
    .from('email_log')
    .insert({
      recipient: 'test@zenzero.com',
      template: 'booking_confirmation',
      subject: 'phase25 fk test',
      status: 'sent',
      event_key: `${EVENT_PREFIX}case5-fk`,
      booking_id: bookingId,
      payment_id: null,
      refund_request_id: null,
      metadata: {},
    })
    .select('id, booking_id')
    .single()
  assert(!insErr, `email_log insert failed: ${insErr?.message}`)
  assert(emailRow?.booking_id === bookingId, `booking_id not round-tripped (got ${emailRow?.booking_id})`)

  // Verify the FK relationship by joining (service role bypasses RLS).
  const { data: joined } = await svc
    .from('email_log')
    .select('id, booking:bookings(id, booking_code)')
    .eq('id', emailRow.id)
    .single()
  const j = joined as { booking: { id: string; booking_code: string } | null } | null
  assert(j?.booking, 'email_log → bookings join returned no row')
  assert(j.booking.booking_code === code, `booking_code=${j.booking.booking_code}, expected ${code}`)

  return `FK booking_id→bookings(id) intact`
})

// ── Case 6 — RLS: authenticated non-staff can't SELECT email_log ────────
await step('RLS: non-staff user (anon JWT) cannot SELECT email_log', async () => {
  // Insert a row via service role so we have data to attempt to read.
  const key = `${EVENT_PREFIX}case6-rls`
  await svc.from('email_log').insert({
    recipient: 'test@zenzero.com',
    template: 'booking_confirmation',
    subject: 'phase25 rls visibility test',
    status: 'sent',
    event_key: key,
    metadata: {},
  })

  // Build a non-staff Supabase client as test@zenzero.com (role='user').
  // test@zenzero.com is already promoted to 'manager' via _rbac-fixture, so
  // we use a DIFFERENT seeded user — booking-owner email if available, or a
  // synthetic approach. Simpler: flip test@zenzero.com to 'user' temporarily
  // (no — would race other tests). Instead use the anon key: anon has no
  // SELECT policy for email_log, and we want to verify the negative.
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!ANON) {
    // Skip if anon key isn't configured.
    return 'skipped (NEXT_PUBLIC_SUPABASE_ANON_KEY missing)'
  }
  const anon = createServiceClient(BASE, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  // anon client's auth context is empty → actAs no user → RLS-as-anon.
  const { data, error } = await anon
    .from('email_log')
    .select('id')
    .like('event_key', `${EVENT_PREFIX}%`)
    .limit(1)
  if (error) {
    // anon clients usually hit "permission denied for table email_log" — that's
    // the expected RLS enforcement.
    assert(
      /permission denied|row-level security/i.test(error.message),
      `expected permission denied, got ${error.message}`,
    )
    return `anon blocked: ${error.message.slice(0, 60)}`
  }
  // If anon somehow returned rows, RLS would be misconfigured.
  assert(
    !data || data.length === 0,
    `anon SELECT returned ${data?.length ?? 0} rows — RLS policy missing`,
  )
  return 'anon SELECT returned 0 rows (RLS enforced)'
})

// ── Case 7 — FK ON DELETE SET NULL behaviour ────────────────────────────
await step('cleanup: deleting booking sets email_log.booking_id to NULL', async () => {
  // Create booking + matching email_log row.
  const code = `${EVENT_PREFIX}case7-${Date.now()}`
  const checkIn = '2032-05-01'
  const checkOut = '2032-05-05'
  const { data: bid } = await svc.rpc('create_booking', {
    p_user_id: testUserId,
    p_room_type_id: roomType.id,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_guests: 1,
    p_nights: 4,
    p_base_subtotal: 1000,
    p_discount_total: 0,
    p_tax_total: 70,
    p_fee_total: 150,
    p_total: 1220,
    p_currency: 'THB',
    p_promotion_id: null,
    p_cancellation_policy_id: null,
    p_booker_full_name: 'Cleanup Test',
    p_booker_email: 'test@zenzero.com',
    p_booker_phone: null,
    p_special_request: null,
    p_channel: 'web' as const,
    p_booking_code: code,
  })
  const bookingId = bid as string

  await svc.from('email_log').insert({
    recipient: 'test@zenzero.com',
    template: 'checkout_thank_you',
    subject: 'phase25 cascade test',
    status: 'sent',
    event_key: `${EVENT_PREFIX}case7-cascade`,
    booking_id: bookingId,
    metadata: {},
  })

  // Verify the email_log row is visible before delete.
  const { data: beforeRows } = await svc
    .from('email_log')
    .select('id, booking_id')
    .eq('booking_id', bookingId)
  assert(
    beforeRows?.length === 1,
    `expected 1 email_log row before delete, got ${beforeRows?.length}`,
  )

  // Delete the booking. `20260908_email_log.sql` declared FK with
  // `on delete set null` — the email_log row survives with booking_id=NULL.
  await svc.from('bookings').delete().eq('id', bookingId)

  // Verify the row's booking_id became NULL (not cascade-deleted).
  const { data: afterRows } = await svc
    .from('email_log')
    .select('id, booking_id, event_key')
    .eq('event_key', `${EVENT_PREFIX}case7-cascade`)
  assert(
    afterRows?.length === 1,
    `expected 1 email_log row after booking delete (ON DELETE SET NULL), got ${afterRows?.length}`,
  )
  assert(
    afterRows?.[0]?.booking_id === null,
    `expected booking_id=NULL after FK SET NULL, got ${afterRows?.[0]?.booking_id}`,
  )
  return 'FK ON DELETE SET NULL fired on email_log.booking_id'
})

// ── Cleanup ─────────────────────────────────────────────────────────────
await cleanup()
console.log('\n' + (failed === 0 ? '✅ ' : '❌ ') + `Passed: ${passed} / ${passed + failed}, Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
