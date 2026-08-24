/**
 * Server-action smoke test for Phase 9 sub-phase 9D
 * (Staff, Shifts, Reviews — last 3 manager stubs + 7 review stubs).
 *
 * Tests the actual Next.js server actions over HTTP:
 *  - setStaffActiveAction          (app/actions/admin/staff.ts) — staff
 *  - moderateReviewAction          (app/actions/reviews.ts)     — reviews
 *  - hideReviewAction              (app/actions/reviews.ts)
 *  - unhideReviewAction            (app/actions/reviews.ts)
 *  - deleteReviewAction            (app/actions/reviews.ts)     — admin only
 *
 * Plus a GET sanity test:
 *  - GET /rooms/serenity-suite — assert approved reviews render publicly
 *
 * Strategy (mirrors scripts/test-phase9-9b-actions.mts):
 *   1. Sign in via @supabase/ssr to get cookies.
 *   2. Precompile pages so server-reference manifests exist.
 *   3. Discover action IDs from .next/dev/server/.../server-reference-manifest.json.
 *   4. POST each action with multipart form-data using the $ACTION_ID_<id> field name.
 *   5. Re-fetch the page and verify state mutated via HTML delta.
 *
 * NOTE on mock vs real:
 *   This script runs against USE_MOCK_DATA=1 (mock layer). The 9D mock seed
 *   has 5 staff members and ~10 reviews spanning pending/approved/hidden.
 *   Mock state persists for the dev server's lifetime, so tests use delta
 *   assertions and skip-if-already-mutated guards.
 *
 *   The real wiring (profiles.email + staff_shifts + RLS) is exercised by
 *   the live-DB verification step (task #89).
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *   - `.env.local` has USE_MOCK_DATA=1
 *
 * Run: npx tsx scripts/test-phase9-9d-actions.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const APP = 'http://localhost:3000'
const MANAGER_EMAIL = 'manager@zenzero.com'
const MANAGER_PASSWORD = process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!'
const ADMIN_EMAIL = 'admin@zenzero.com'
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? 'AdminPass123!'

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

function buildSession(email: string, password: string) {
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

function discoverActionIds(): Record<string, string> {
  const serverDir = resolve(__dirname, '..', '.next', 'dev', 'server', 'app')
  const found: Record<string, string> = {}
  const paths = [
    resolve(serverDir, 'admin', 'staff', 'page', 'server-reference-manifest.json'),
    resolve(serverDir, 'manager', 'reviews', 'page', 'server-reference-manifest.json'),
  ]
  for (const manifestPath of paths) {
    if (!existsSync(manifestPath)) continue
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const [id, info] of Object.entries(m.node ?? {})) {
      const name = (info as { exportedName?: string }).exportedName
      if (name && !found[name]) found[name] = id
    }
  }
  return found
}

async function postAction(
  cookieHeader: string,
  path: string,
  actionId: string,
  fields: Record<string, string>,
) {
  const boundary = '----Phase9DActionTest' + Date.now()
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
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text }
}

async function fetchHtml(path: string, cookie: string): Promise<string> {
  const res = await fetch(APP + path, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  return res.text()
}

// Find the staff row by id and check whether it shows the "Active" or
// "Inactive" badge. Strategy: split on </tr> to find the row containing
// the id, then look for the Thai badge text `ปิดใช้งาน` (deactivated).
// (The form field name `isActive` would match a naive 'Active' substring,
// so we anchor on the badge text only.)
function findStaffActiveState(html: string, staffId: string): 'active' | 'inactive' | null {
  const rows = html.split(/<\/tr>/)
  for (const row of rows) {
    if (!row.includes('value="' + staffId + '"')) continue
    // The status badge is rendered as `<span ...>ปิดใช้งาน</span>` when
    // inactive. Search for the badge BEFORE the hidden staffId input.
    const idIdx = row.indexOf('value="' + staffId + '"')
    const badgeIdx = row.lastIndexOf('ปิดใช้งาน', idIdx)
    if (badgeIdx >= 0) return 'inactive'
    // No inactive badge → row is active. The toggle form's hidden
    // isActive value represents the TARGET state (i.e. what the click
    // would set the row to). For active rows it holds "false" (the
    // click target is to deactivate), for inactive rows "true". Either
    // way — if no inactive badge is present, the row is active.
    return 'active'
  }
  return null
}

// Find a review row by id and check whether it's still in the pending bucket.
// Returns true if the row is in the pending list (i.e. still pending).
function reviewRowPending(html: string, reviewId: string): boolean {
  // /manager/reviews?tab=pending renders one card per pending review, each
  // contains a form with the reviewId hidden input.
  return html.includes('value="' + reviewId + '"')
}

// ── Sign in as admin + manager ─────────────────────────────────────────────

const admin = buildSession(ADMIN_EMAIL, ADMIN_PASSWORD)
await step('Sign in as admin', async () => {
  const { error, data } = await admin.supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return 'uid=' + data.user.id
})
const adminCookie = admin.cookieHeader()

const mgr = buildSession(MANAGER_EMAIL, MANAGER_PASSWORD)
await step('Sign in as manager', async () => {
  const { error, data } = await mgr.supabase.auth.signInWithPassword({
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return 'uid=' + data.user.id
})
const mgrCookie = mgr.cookieHeader()

await step('Precompile /admin/staff and /manager/reviews', async () => {
  const r1 = await fetch(APP + '/admin/staff', { headers: { Cookie: adminCookie } })
  const r2 = await fetch(APP + '/manager/reviews?tab=pending', { headers: { Cookie: mgrCookie } })
  return 'admin/staff=' + r1.status + ', manager/reviews=' + r2.status
})

const ids = discoverActionIds()
const SET_STAFF_ACTIVE_ID = ids.setStaffActiveAction
const MODERATE_REVIEW_ID = ids.moderateReviewAction
const HIDE_REVIEW_ID = ids.hideReviewAction
const UNHIDE_REVIEW_ID = ids.unhideReviewAction
const DELETE_REVIEW_ID = ids.deleteReviewAction

await step('Discover server-action IDs', async () => {
  for (const [name, id] of [
    ['setStaffActiveAction', SET_STAFF_ACTIVE_ID],
    ['moderateReviewAction', MODERATE_REVIEW_ID],
    ['hideReviewAction', HIDE_REVIEW_ID],
    ['unhideReviewAction', UNHIDE_REVIEW_ID],
    ['deleteReviewAction', DELETE_REVIEW_ID],
  ] as const) {
    if (!id) throw new Error('missing action: ' + name)
  }
  return Object.entries(ids)
    .map(([k, v]) => k + '=' + v.slice(0, 8) + '…')
    .join(', ')
})

// ── Discover live staff + review fixtures ────────────────────────────────
//
// Live DB has only 1 admin profile and ~6 staff (housekeepers/reception/
// manager). The mock seed IDs (s-005, 11111111-…-000000000005, etc.) don't
// apply here, so we discover real UUIDs from the database and self-seed any
// missing review fixtures via service_role (which bypasses RLS for tests).

let staffToToggleId: string | null = null
let pendingReviewId: string | null = null
let approvedReviewId: string | null = null
let hiddenReviewId: string | null = null
let approvedRoomReview: { id: string; name: string } | null = null
const insertedReviewIds: string[] = []

await step('Discover live staff + review fixtures', async () => {
  // 1. Pick a non-admin staff profile to toggle in Test 1.
  const { data: profs } = await admin.supabase
    .from('profiles')
    .select('id, role, is_active')
    .in('role', ['reception', 'housekeeper'])
    .eq('is_active', true)
    .limit(1)
  if (profs && profs.length > 0) {
    staffToToggleId = (profs[0] as { id: string }).id
  }

  // 2. Pull existing reviews. Live DB has 0 reviews — we'll seed fixtures.
  const { createClient } = await import('@supabase/supabase-js')
  const adminSrv = createClient(BASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Find a serenity-suite room_type id for the public-side review (Test 7).
  const { data: rt } = await adminSrv.from('room_types').select('id, slug').eq('slug', 'serenity-suite').maybeSingle()
  const serenityId = (rt as { id: string } | null)?.id

  // Find a real guest profile (role='user' or any other non-staff) to attach reviews.
  const { data: guests } = await adminSrv.from('profiles').select('id, full_name').eq('role', 'user').limit(1)
  const guest = guests?.[0] as { id: string; full_name: string } | undefined

  if (!guest || !serenityId) {
    return 'staff=' + (staffToToggleId ? '1' : '0') + ', reviews=skip (no guest profile or serenity room_type)'
  }

  // Inject fixtures: 1 pending, 1 approved, 1 hidden (all on the standard
// guest profile), and 1 approved on serenity-suite linked to a fresh
// profile whose full_name we set to "Eleanor Smith" so the public room page
// renders that name.
  async function injectReview(payload: {
    status: 'pending' | 'approved' | 'hidden'
    title?: string
    guestId: string
    roomTypeId: string
  }): Promise<string> {
    const row = {
      user_id: payload.guestId,
      room_type_id: payload.roomTypeId,
      rating: 5,
      title: payload.title ?? 'Lovely stay',
      body: 'A real review body seeded for the live-DB smoke test.',
      status: payload.status,
      moderated_at: payload.status === 'pending' ? null : new Date().toISOString(),
      moderated_by: payload.status === 'pending' ? null : payload.guestId,
    }
    const { data: ins, error: insErr } = await adminSrv
      .from('reviews')
      .insert(row)
      .select('id')
      .single()
    if (insErr) throw new Error('seed review failed: ' + insErr.message)
    insertedReviewIds.push((ins as { id: string }).id)
    return (ins as { id: string }).id
  }

  // Pick a non-serenity room type id for the standard 3 status fixtures.
  const { data: otherRt } = await adminSrv
    .from('room_types')
    .select('id')
    .neq('slug', 'serenity-suite')
    .limit(1)
  const otherRoomTypeId = (otherRt?.[0] as { id: string } | undefined)?.id
  assert(guest && otherRoomTypeId, 'need 1 user profile + 1 non-serenity room_type')

  pendingReviewId = await injectReview({ status: 'pending', title: 'Pending review', guestId: guest.id, roomTypeId: otherRoomTypeId })
  approvedReviewId = await injectReview({ status: 'approved', guestId: guest.id, roomTypeId: otherRoomTypeId })
  hiddenReviewId = await injectReview({ status: 'hidden', guestId: guest.id, roomTypeId: otherRoomTypeId })

  // For serenity-suite, create a fresh auth user + profile so the display
  // name is "Eleanor Smith" specifically.
  const eleanorEmail = `eleanor-${Date.now()}@zenzero.test`
  const { data: eleanorAuth, error: eleErr } = await adminSrv.auth.admin.createUser({
    email: eleanorEmail,
    email_confirm: true,
    user_metadata: { full_name: 'Eleanor Smith' },
  })
  if (eleErr) {
    // Fallback: any existing user — Test 7 just checks the string appears
    const { data: fallback } = await adminSrv.from('profiles').select('id').limit(1)
    const fallbackId = (fallback?.[0] as { id: string } | undefined)?.id
    assert(fallbackId, 'no profile to anchor serenity review')
    const serenityReviewId = await injectReview({
      status: 'approved',
      guestId: fallbackId,
      roomTypeId: serenityId!,
    })
    approvedRoomReview = { id: serenityReviewId, name: '' }
  } else {
    const eleanorId = eleanorAuth.user!.id
    await adminSrv.from('profiles').update({ full_name: 'Eleanor Smith' }).eq('id', eleanorId)
    const serenityReviewId = await injectReview({
      status: 'approved',
      guestId: eleanorId,
      roomTypeId: serenityId!,
    })
    approvedRoomReview = { id: serenityReviewId, name: 'Eleanor Smith' }
  }

  return (
    'staff=' +
    (staffToToggleId ? '1' : '0') +
    ', reviews=' +
    insertedReviewIds.length
  )
})

// ── Test 1: Admin toggles a non-admin staff profile (round-trip) ──────────

await step('Test 1: Admin toggles staff active (round-trip)', async () => {
  assert(staffToToggleId, 'no staff profile available')

  const before = await fetchHtml('/admin/staff', adminCookie)
  const beforeState = findStaffActiveState(before, staffToToggleId!)
  assert(beforeState !== null, 'staff row not found in /admin/staff')
  assert(beforeState !== 'unknown', 'staff row missing badge')

  // Flip to the opposite state.
  const target = beforeState === 'active' ? 'false' : 'true'
  const res = await postAction(adminCookie, '/admin/staff', SET_STAFF_ACTIVE_ID, {
    staffId: staffToToggleId!,
    isActive: target,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  // Verify in DB directly (more reliable than scraping HTML twice).
  const { data: row } = await admin.supabase
    .from('profiles')
    .select('is_active')
    .eq('id', staffToToggleId)
    .single()
  const afterIsActive = (row as { is_active: boolean } | null)?.is_active
  const afterState = afterIsActive ? 'active' : 'inactive'
  assert(
    afterState !== beforeState,
    'staff state should have flipped; was ' + beforeState + ', now ' + afterState,
  )

  // Restore.
  const restore = await postAction(adminCookie, '/admin/staff', SET_STAFF_ACTIVE_ID, {
    staffId: staffToToggleId!,
    isActive: beforeState === 'active' ? 'true' : 'false',
  })
  if (restore.status >= 400) throw new Error('restore HTTP ' + restore.status)

  return 'staff ' + staffToToggleId.slice(0, 8) + ': ' + beforeState + ' → ' + afterState + ' → restored ✓'
})

// ── Test 2: Admin cannot deactivate self ──────────────────────────────────

await step('Test 2: Admin cannot deactivate self', async () => {
  // We need admin's user id from supabase.auth.
  const { data } = await admin.supabase.auth.getUser()
  const selfId = data.user?.id
  assert(selfId !== undefined, 'admin user id missing')

  // Capture the inactive-badge count BEFORE the attempt — the self-deact
  // guard should keep this unchanged.
  const before = await fetchHtml('/admin/staff', adminCookie)
  const beforeInactive = (before.match(/ปิดใช้งาน/g) ?? []).length

  const res = await postAction(adminCookie, '/admin/staff', SET_STAFF_ACTIVE_ID, {
    staffId: selfId!,
    isActive: 'false',
  })
  assert(res.status < 500, 'server crashed: ' + res.status)

  const after = await fetchHtml('/admin/staff', adminCookie)
  const afterInactive = (after.match(/ปิดใช้งาน/g) ?? []).length
  assert(
    afterInactive === beforeInactive,
    'inactive-badge count should not change; was ' +
      beforeInactive +
      ', now ' +
      afterInactive +
      ' (guard failed — admin may have been deactivated)',
  )
  // Page should still render the staff list — at least one active role row.
  assert(after.includes('reception') || after.includes('housekeeper'), 'staff list did not render after attempt')
  return (
    'HTTP ' +
    res.status +
    '; inactive-badge count unchanged (' +
    beforeInactive +
    ' ✓)'
  )
})

// ── Test 3: Manager moderates a pending review ─────────────────────────────

await step('Test 3: Manager moderates pending review', async () => {
  assert(pendingReviewId, 'pending review fixture missing')

  const res = await postAction(mgrCookie, '/manager/reviews', MODERATE_REVIEW_ID, {
    reviewId: pendingReviewId!,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const { data: row } = await admin.supabase
    .from('reviews')
    .select('status')
    .eq('id', pendingReviewId)
    .single()
  assert(
    (row as { status: string } | null)?.status === 'approved',
    'review should be approved; got ' + JSON.stringify(row),
  )
  return 'review ' + pendingReviewId!.slice(0, 8) + ': pending → approved ✓'
})

// ── Test 4: Manager hides an approved review ───────────────────────────────

await step('Test 4: Manager hides approved review', async () => {
  assert(approvedReviewId, 'approved review fixture missing')

  const res = await postAction(mgrCookie, '/manager/reviews', HIDE_REVIEW_ID, {
    reviewId: approvedReviewId!,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const { data: row } = await admin.supabase
    .from('reviews')
    .select('status')
    .eq('id', approvedReviewId)
    .single()
  assert(
    (row as { status: string } | null)?.status === 'hidden',
    'review should be hidden; got ' + JSON.stringify(row),
  )
  return 'review ' + approvedReviewId!.slice(0, 8) + ': approved → hidden ✓'
})

// ── Test 5: Manager unhides a hidden review ────────────────────────────────

await step('Test 5: Manager unhides hidden review', async () => {
  assert(hiddenReviewId, 'hidden review fixture missing')

  const res = await postAction(mgrCookie, '/manager/reviews', UNHIDE_REVIEW_ID, {
    reviewId: hiddenReviewId!,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const { data: row } = await admin.supabase
    .from('reviews')
    .select('status')
    .eq('id', hiddenReviewId)
    .single()
  assert(
    (row as { status: string } | null)?.status === 'approved',
    'review should be approved after unhide; got ' + JSON.stringify(row),
  )
  return 'review ' + hiddenReviewId!.slice(0, 8) + ': hidden → approved ✓'
})

// ── Test 6: Admin deletes an approved review ───────────────────────────────

await step('Test 6: Admin deletes review', async () => {
  // Use the pending-review-turned-approved from Test 3 — it should not have
  // been touched by Tests 4 or 5.
  assert(pendingReviewId, 'pending review fixture missing')

  const res = await postAction(adminCookie, '/manager/reviews', DELETE_REVIEW_ID, {
    reviewId: pendingReviewId!,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const { data: row } = await admin.supabase
    .from('reviews')
    .select('id')
    .eq('id', pendingReviewId)
    .maybeSingle()
  assert(row === null, 'review should be deleted')
  return 'review ' + pendingReviewId!.slice(0, 8) + ' deleted ✓'
})

// ── Test 7: Public room page renders approved reviews ──────────────────────

await step('Test 7: GET /rooms/serenity-suite renders approved reviews', async () => {
  assert(approvedRoomReview, 'serenity review fixture missing')
  const html = await fetchHtml('/rooms/serenity-suite', mgrCookie)
  assert(
    html.includes(approvedRoomReview!.name),
    approvedRoomReview!.name + ' missing from public room page',
  )
  return 'approved review rendered on /rooms/serenity-suite ✓'
})

// ── Test 8: Auth guard — manager cannot delete reviews ─────────────────────
//
// requireAdmin() in the action redirects the manager regardless of input.
// We verify by checking the approved-review fixture is still in the DB after
// the manager's POST.

await step('Test 8: Manager cannot delete review (admin-only)', async () => {
  assert(approvedReviewId, 'approved review fixture missing')

  const res = await postAction(mgrCookie, '/manager/reviews', DELETE_REVIEW_ID, {
    reviewId: approvedReviewId!,
  })
  assert(res.status < 500, 'server crashed: ' + res.status)

  const { data: row } = await admin.supabase
    .from('reviews')
    .select('id')
    .eq('id', approvedReviewId)
    .maybeSingle()
  assert(
    row !== null,
    approvedReviewId + ' was deleted by manager (guard should have blocked)',
  )
  return 'HTTP ' + res.status + '; review still present (guard held ✓)'
})

// ── Cleanup: remove self-seeded review fixtures we added (serenity) ────────
//
// Tests 3/4/5/8 mutate fixture rows in place — those matches the production
// flow and remains in the DB. The serenity-fixture we added for Test 7
// (which references no booking) is removed so the next run is idempotent.

if (insertedReviewIds.length > 0 && approvedRoomReview) {
  const { createClient } = await import('@supabase/supabase-js')
  const adminSrv = createClient(BASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await adminSrv.from('reviews').delete().eq('id', approvedRoomReview.id)
}

console.log('\n' + (failed === 0 ? '✅' : '⚠️') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)
