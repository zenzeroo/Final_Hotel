/**
 * Phase 17 — createCheckoutSessionAction RBAC matrix.
 *
 * Verifies the action's permission model:
 *   - Booking owner can open a checkout session for their own booking
 *   - Other users (including housekeeper) cannot — not owner, not staff
 *   - Staff (reception / manager / admin) can open a checkout session
 *     for any booking (e.g. walk-in flow paid at the front desk)
 *   - Invalid UUID input is rejected at the zod layer (all roles)
 *
 * Why the action has no `requireRole()`: the RPC `create_payment_session`
 * is SECURITY DEFINER and verifies owner/staff itself. The action layer
 * only needs an authenticated session (any role); the RPC gates access.
 * Walk-in payments made by reception go through the same action, so we
 * can't enforce "user-only" at the action level.
 *
 * Strategy: HTTP server-action invocation with the
 * `$ACTION_ID_<id>` multipart field pattern (Phase 12 lesson —
 * Next.js 16 server actions require this field, not the legacy header).
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *   - `.env.local` has STRIPE_SECRET_KEY (test key)
 *   - Migration 20260902_payments_and_rpc.sql has been applied
 *   - Seed users: admin/manager/reception/somjit/test@zenzero.com
 *
 * Run: npx tsx scripts/test-phase17-payment-rbac.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { pgPoolerConfig } from './_db-connection.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP = 'http://localhost:3000'

const ROLES = {
  admin: { email: 'admin@zenzero.com', password: process.env.ADMIN_TEST_PASSWORD ?? 'AdminPass123!' },
  manager: { email: 'manager@zenzero.com', password: process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!' },
  reception: { email: 'reception@zenzero.com', password: process.env.RECEPTION_TEST_PASSWORD ?? 'ReceptionPass123!' },
  housekeeper: { email: 'somjit@zenzero.com', password: process.env.HOUSEKEEPER_TEST_PASSWORD ?? 'Housekeep123!' },
  user: { email: 'test@zenzero.com', password: process.env.USER_TEST_PASSWORD ?? 'TestPass123!' },
} as const

type Role = keyof typeof ROLES

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

function buildSession() {
  const cookies: { name: string; value: string; opts?: CookieOptions }[] = []
  const supabase = createServerClient(BASE, ANON, {
    cookies: {
      getAll: () => cookies.map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          const i = cookies.findIndex((c) => c.name === name)
          if (i >= 0) cookies[i] = { name, value, opts: options }
          else cookies.push({ name, value, opts: options })
        }
      },
    },
  })
  return {
    cookies,
    supabase,
    cookieHeader: () => cookies.map((c) => c.name + '=' + c.value).join('; '),
  }
}

const admin = createServiceClient(BASE, SERVICE_KEY, { db: pgPoolerConfig() })

async function fetchHtml(path: string, cookie?: string): Promise<string> {
  const res = await fetch(APP + path, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: 'manual',
  })
  return res.text()
}

async function postAction(
  cookieHeader: string,
  path: string,
  actionId: string,
  fields: Record<string, string>,
) {
  const boundary = '----Phase17PaymentRbac' + Date.now()
  const parts: Buffer[] = []
  const marker =
    '--' +
    boundary +
    '\r\n' +
    'Content-Disposition: form-data; name="$ACTION_ID_' +
    actionId +
    '"\r\n\r\n\r\n'
  parts.push(Buffer.from(marker))
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from('--' + boundary + '\r\n'))
    parts.push(Buffer.from('Content-Disposition: form-data; name="' + k + '"\r\n\r\n'))
    parts.push(Buffer.from(v))
    parts.push(Buffer.from('\r\n'))
  }
  parts.push(Buffer.from('--' + boundary + '--\r\n'))
  const body = Buffer.concat(parts)
  const res = await fetch(APP + path, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader,
      Origin: APP,
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
    },
    body,
    redirect: 'manual',
  })
  return { status: res.status, text: await res.text() }
}

function discoverActionIds(): Record<string, string> {
  const serverDir = resolve(__dirname, '..', '.next', 'dev', 'server', 'app')
  const found: Record<string, string> = {}
  const candidates = [
    resolve(serverDir, '(booking)', 'bookings', '[id]', 'page', 'server-reference-manifest.json'),
    resolve(serverDir, 'reception', 'bookings', 'new', 'page', 'server-reference-manifest.json'),
  ]
  for (const manifestPath of candidates) {
    if (!existsSync(manifestPath)) continue
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const [id, info] of Object.entries(m.node ?? {})) {
      const name = (info as { exportedName?: string }).exportedName
      if (name && !found[name]) found[name] = id
    }
  }
  return found
}

// ── Sign in all 5 roles + build their cookie headers ────────────────────

const sessions: Record<Role, ReturnType<typeof buildSession>> = {} as Record<Role, ReturnType<typeof buildSession>>
for (const role of Object.keys(ROLES) as Role[]) {
  const { email, password } = ROLES[role]
  const s = buildSession()
  await step(`Sign in as ${role}`, async () => {
    const { error, data } = await s.supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('no user')
    sessions[role] = s
    return 'uid=' + data.user.id.slice(0, 8)
  })
}

// ── Pre-compile + discover action ID ─────────────────────────────────────

await step('Precompile /bookings/[id] (warm server reference manifest)', async () => {
  await fetchHtml('/bookings/00000000-0000-0000-0000-000000000000', sessions.user.cookieHeader())
  return 'warmed'
})

const ids = discoverActionIds()
const ACTION_ID = ids.createCheckoutSessionAction
if (!ACTION_ID) {
  console.error('createCheckoutSessionAction ID not found in manifest. Did /bookings/[id] compile?')
  process.exit(1)
}
await step('Discover createCheckoutSessionAction ID', async () => {
  return 'id=' + ACTION_ID.slice(0, 8) + '…'
})

// ── Fixture: ownBooking (user-owned) + otherBooking (admin-owned) ──────

const TEST_EMAIL = 'test@zenzero.com'

let ownBookingId: string
let otherBookingId: string

await step('Seed fixture: ownBooking (user) + otherBooking (admin)', async () => {
  const { data: rt } = await admin
    .from('room_types')
    .select('id, base_price')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!rt) throw new Error('no active room_type seeded')

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const userRecord = users?.users?.find((u) => u.email === TEST_EMAIL)
  const adminRecord = users?.users?.find((u) => u.email === ROLES.admin.email)
  if (!userRecord) throw new Error('seed user missing: ' + TEST_EMAIL)
  if (!adminRecord) throw new Error('seed admin missing: ' + ROLES.admin.email)

  // ownBooking: owned by test user.
  const { data: own } = await admin
    .from('bookings')
    .insert({
      booking_code: 'ZZR-PH17U' + Date.now().toString().slice(-5),
      user_id: userRecord.id,
      room_type_id: rt.id,
      check_in: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      check_out: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10),
      guests: 2,
      nights: 2,
      base_subtotal: rt.base_price * 2,
      total: rt.base_price * 2,
      currency: 'THB',
      status: 'confirmed',
      payment_status: 'unpaid',
      booker_full_name: 'Phase 17 RBAC Test',
      booker_email: TEST_EMAIL,
      booker_phone: '0890000008',
      channel: 'web',
    })
    .select('id')
    .single()
  if (!own) throw new Error('ownBooking insert failed')
  ownBookingId = own.id

  // otherBooking: owned by admin (not by test user).
  const { data: other } = await admin
    .from('bookings')
    .insert({
      booking_code: 'ZZR-PH17A' + Date.now().toString().slice(-5),
      user_id: adminRecord.id,
      room_type_id: rt.id,
      check_in: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      check_out: new Date(Date.now() + 16 * 86400000).toISOString().slice(0, 10),
      guests: 2,
      nights: 2,
      base_subtotal: rt.base_price * 2,
      total: rt.base_price * 2,
      currency: 'THB',
      status: 'confirmed',
      payment_status: 'unpaid',
      booker_full_name: 'Phase 17 RBAC Other',
      booker_email: ROLES.admin.email,
      booker_phone: '0890000009',
      channel: 'web',
    })
    .select('id')
    .single()
  if (!other) throw new Error('otherBooking insert failed')
  otherBookingId = other.id

  return `own=${own.id.slice(0, 8)} other=${other.id.slice(0, 8)}`
})

// ── Run the RBAC matrix ──────────────────────────────────────────────────
//
// For each role, call createCheckoutSessionAction with (ownBooking, otherBooking, bad-uuid).
//   ownBooking → expect ok for owner or staff
//   otherBooking → expect ok only for staff
//   bad uuid → expect error (zod validation, all roles)

const BAD_UUID = 'not-a-uuid'
const PATH = '/bookings/' + ownBookingId

for (const role of Object.keys(ROLES) as Role[]) {
  const isStaff = role === 'reception' || role === 'manager' || role === 'admin'

  await step(`${role} → createCheckoutSession on OWN booking`, async () => {
    const r = await postAction(sessions[role].cookieHeader(), PATH, ACTION_ID, {
      bookingId: ownBookingId,
    })
    // Parse JSON response (server actions return JSON).
    const json = JSON.parse(r.text || '{}') as { ok?: boolean; data?: { url?: string }; error?: string }
    if (role === 'user') {
      assert(json.ok === true, `user(owner) should succeed, got: ${r.text.slice(0, 200)}`)
      assert(typeof json.data?.url === 'string' && json.data.url.includes('checkout.stripe.com'), 'url should point to Stripe')
      return 'ok=true url=' + (json.data.url ?? '').slice(0, 40) + '…'
    } else if (isStaff) {
      // Staff can open checkout for any booking (walk-in flow).
      assert(json.ok === true, `${role}(staff) on own-booking should succeed, got: ${r.text.slice(0, 200)}`)
      return 'ok=true (staff override)'
    } else {
      // housekeeper — non-owner non-staff
      assert(json.ok === false, `housekeeper on own-booking should fail, got: ${r.text.slice(0, 200)}`)
      return 'ok=false blocked'
    }
  })

  await step(`${role} → createCheckoutSession on OTHER booking`, async () => {
    const r = await postAction(sessions[role].cookieHeader(), PATH, ACTION_ID, {
      bookingId: otherBookingId,
    })
    const json = JSON.parse(r.text || '{}') as { ok?: boolean; data?: { url?: string }; error?: string }
    if (isStaff) {
      assert(json.ok === true, `${role}(staff) should succeed on other's booking, got: ${r.text.slice(0, 200)}`)
      return 'ok=true (staff override)'
    } else {
      assert(json.ok === false, `${role} on other's booking should fail, got: ${r.text.slice(0, 200)}`)
      return 'ok=false blocked'
    }
  })

  await step(`${role} → createCheckoutSession with BAD UUID`, async () => {
    const r = await postAction(sessions[role].cookieHeader(), PATH, ACTION_ID, {
      bookingId: BAD_UUID,
    })
    const json = JSON.parse(r.text || '{}') as { ok?: boolean; error?: string }
    // The action's zod schema rejects non-UUIDs before hitting the RPC.
    // Note: the `bookingId` field is captured into formData, but the action
    // receives it as a JSON-encoded arg via Next.js server-action protocol,
    // so the zod validation runs server-side regardless.
    assert(json.ok === false, `bad UUID should be rejected, got: ${r.text.slice(0, 200)}`)
    return 'ok=false zod reject'
  })
}

// ── Cleanup ──────────────────────────────────────────────────────────────

await step('Cleanup fixture (delete test bookings + payments)', async () => {
  await admin.from('payments').delete().in('booking_id', [ownBookingId, otherBookingId])
  await admin.from('bookings').delete().in('id', [ownBookingId, otherBookingId])
})

console.log('\n' + (failed === 0 ? '✅' : '❌') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)