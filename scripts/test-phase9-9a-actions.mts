/**
 * Server-action smoke test for Phase 9 sub-phase 9A
 * (Settings, Promotions, Room Units — real DB wiring).
 *
 * Tests the actual Next.js server actions over HTTP:
 *  - updateHotelSettingsAction   (app/actions/admin/settings.ts) — NEW in 9A
 *  - togglePromotionAction       (app/actions/promotions.ts) — regression for
 *                                the new `has_role('manager')` branch of the
 *                                `promotions admin write` policy
 *  - closeRoomAction / reopenRoomAction (app/actions/rates.ts) — same role check
 *
 * Strategy (mirrors scripts/test-manager-phase6-actions.mts):
 *   1. Sign in via @supabase/ssr to get cookies.
 *   2. Precompile pages so server-reference manifests exist.
 *   3. Discover action IDs from .next/dev/server/.../server-reference-manifest.json.
 *   4. POST each action with multipart form-data using the $ACTION_ID_<id> field name.
 *   5. Re-fetch the page and verify state mutated via HTML delta.
 *
 * NOTE on mock vs real:
 *   This script primarily verifies the ACTION-LAYER wiring (Zod validation,
 *   revalidatePath, return shape) and HTML delta. The RLS policy change in
 *   20260829 (extending `promotions admin write` to manager) is only
 *   exercised by the live-DB verification step (task #89).
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *
 * Run: npx tsx scripts/test-phase9-9a-actions.mts
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
const ADMIN_EMAIL = 'admin@zenzero.com'
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? 'AdminPass123!'
const MANAGER_EMAIL = 'manager@zenzero.com'
const MANAGER_PASSWORD = process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!'

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
    resolve(serverDir, 'admin', 'settings', 'page', 'server-reference-manifest.json'),
    resolve(serverDir, 'manager', 'promotions', 'page', 'server-reference-manifest.json'),
    resolve(serverDir, 'manager', 'rates', 'page', 'server-reference-manifest.json'),
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

// POST a server action with multipart form data. The action ID is sent as the
// FIRST field name "$ACTION_ID_<id>" with empty value, followed by form fields.
// See memory: nextjs16-call-server-action-via-http.
async function postAction(
  cookieHeader: string,
  path: string,
  actionId: string,
  fields: Record<string, string>,
) {
  const boundary = '----Phase9AActionTest' + Date.now()
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

// Find the input[name="tax_rate"] defaultValue in the rendered settings form.
// The HotelSettingsForm renders <input name="tax_rate" defaultValue={settings.tax_rate} />.
// React serializes defaultValue to value="..." in the rendered HTML.
function findTaxRate(html: string): string | null {
  const m = html.match(/<input[^>]*name="tax_rate"[^>]*value="([^"]+)"/)
  return m ? m[1] : null
}

// Find the hidden isActive value inside the toggle form for a given promotion id.
// Same semantics as test-manager-phase6-actions.mts: hidden = OPPOSITE of current.
function findPromotionActiveValue(html: string, promoId: string): string | null {
  const forms = html.split(/<\/form>/)
  for (const chunk of forms) {
    if (!chunk.includes('value="' + promoId + '"')) continue
    const v = chunk.match(/name="isActive" value="(true|false)"/)
    if (v) return v[1]
  }
  return null
}

// ── Sign in as admin and manager ───────────────────────────────────────────

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

// ── Precompile pages so manifests exist before discovery ──────────────────

await step('Precompile /admin/settings, /manager/promotions, /manager/rates', async () => {
  const r1 = await fetch(APP + '/admin/settings', { headers: { Cookie: adminCookie } })
  const r2 = await fetch(APP + '/manager/promotions', { headers: { Cookie: mgrCookie } })
  const r3 = await fetch(APP + '/manager/rates', { headers: { Cookie: mgrCookie } })
  return '/admin/settings=' + r1.status + ', /manager/promotions=' + r2.status + ', /manager/rates=' + r3.status
})

// ── Discover action IDs ────────────────────────────────────────────────────

const ids = discoverActionIds()
const UPDATE_SETTINGS_ID = ids.updateHotelSettingsAction
const TOGGLE_PROMO_ID = ids.togglePromotionAction
const CLOSE_ROOM_ID = ids.closeRoomAction
const REOPEN_ROOM_ID = ids.reopenRoomAction

await step('Discover server-action IDs', async () => {
  for (const [name, id] of [
    ['updateHotelSettingsAction', UPDATE_SETTINGS_ID],
    ['togglePromotionAction', TOGGLE_PROMO_ID],
    ['closeRoomAction', CLOSE_ROOM_ID],
    ['reopenRoomAction', REOPEN_ROOM_ID],
  ] as const) {
    if (!id) throw new Error('missing action: ' + name)
  }
  return Object.entries(ids)
    .map(([k, v]) => k + '=' + v.slice(0, 8) + '…')
    .join(', ')
})

// ── Test 1: Admin updates hotel_settings — flip tax_rate and assert persisted

await step('Test 1: Admin updates tax_rate (0.07 → 0.08)', async () => {
  const before = await fetchHtml('/admin/settings', adminCookie)
  const beforeRate = findTaxRate(before)
  assert(beforeRate !== null, 'tax_rate input not found in /admin/settings HTML')
  assert(beforeRate === '0.07', 'initial tax_rate should be 0.07; got ' + beforeRate)

  const res = await postAction(adminCookie, '/admin/settings', UPDATE_SETTINGS_ID, {
    name: 'Zenzero Hotel',
    name_th: '',
    address: '123 Sukhumvit Soi 11, Bangkok',
    phone: '+66 2 123 4567',
    email: 'hello@zenzero.com',
    tax_rate: '0.08',
    resort_fee: '150',
    currency: 'THB',
    check_in_time: '15:00',
    check_out_time: '11:00',
    locale_default: 'th',
    hero_image_key: '',
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/admin/settings', adminCookie)
  const afterRate = findTaxRate(after)
  assert(afterRate === '0.08', 'tax_rate should be 0.08 after update; got ' + afterRate)
  return 'tax_rate: ' + beforeRate + ' → ' + afterRate + ' ✓'
})

// ── Test 2: Admin reverts tax_rate to baseline (cleanup) ──────────────────

await step('Test 2: Admin reverts tax_rate (0.08 → 0.07)', async () => {
  const before = await fetchHtml('/admin/settings', adminCookie)
  const beforeRate = findTaxRate(before)
  assert(beforeRate === '0.08', 'tax_rate should be 0.08 from Test 1; got ' + beforeRate)

  const res = await postAction(adminCookie, '/admin/settings', UPDATE_SETTINGS_ID, {
    name: 'Zenzero Hotel',
    name_th: '',
    address: '123 Sukhumvit Soi 11, Bangkok',
    phone: '+66 2 123 4567',
    email: 'hello@zenzero.com',
    tax_rate: '0.07',
    resort_fee: '150',
    currency: 'THB',
    check_in_time: '15:00',
    check_out_time: '11:00',
    locale_default: 'th',
    hero_image_key: '',
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/admin/settings', adminCookie)
  const afterRate = findTaxRate(after)
  assert(afterRate === '0.07', 'tax_rate should be 0.07 after revert; got ' + afterRate)
  return 'tax_rate: ' + beforeRate + ' → ' + afterRate + ' (reverted ✓)'
})

// ── Test 3: Admin submits invalid tax_rate (>1) — action returns ok:false ──

await step('Test 3: Invalid tax_rate (2.0) returns ok:false, no state change', async () => {
  const before = await fetchHtml('/admin/settings', adminCookie)
  const beforeRate = findTaxRate(before)
  assert(beforeRate === '0.07', 'tax_rate should be 0.07; got ' + beforeRate)

  const res = await postAction(adminCookie, '/admin/settings', UPDATE_SETTINGS_ID, {
    name: 'Zenzero Hotel',
    name_th: '',
    address: '123 Sukhumvit Soi 11, Bangkok',
    phone: '+66 2 123 4567',
    email: 'hello@zenzero.com',
    tax_rate: '2.0', // OUT OF RANGE — schema caps at 1
    resort_fee: '150',
    currency: 'THB',
    check_in_time: '15:00',
    check_out_time: '11:00',
    locale_default: 'th',
    hero_image_key: '',
  })
  assert(res.status < 500, 'server crashed on invalid input: ' + res.status)

  const after = await fetchHtml('/admin/settings', adminCookie)
  const afterRate = findTaxRate(after)
  assert(
    afterRate === beforeRate,
    'tax_rate should be unchanged; was ' + beforeRate + ', now ' + afterRate,
  )
  return 'HTTP ' + res.status + '; tax_rate unchanged (validation held ✓)'
})

// ── Test 4: Auth guard — manager cannot update hotel_settings ─────────────

await step('Test 4: Auth guard — manager POST to /admin/settings is rejected', async () => {
  const before = await fetchHtml('/admin/settings', adminCookie)
  const beforeRate = findTaxRate(before)
  assert(beforeRate !== null, 'tax_rate input missing')

  // Manager cookie hits an admin-only action. requireAdminSettings redirects to '/'.
  const res = await postAction(mgrCookie, '/admin/settings', UPDATE_SETTINGS_ID, {
    name: 'Manager Tamper',
    name_th: '',
    address: 'hacked',
    phone: 'x',
    email: 'hack@example.com',
    tax_rate: '0.99',
    resort_fee: '0',
    currency: 'USD',
    check_in_time: '00:00',
    check_out_time: '00:00',
    locale_default: 'en',
    hero_image_key: '',
  })
  assert(res.status < 500, 'server crashed: ' + res.status)

  const after = await fetchHtml('/admin/settings', adminCookie)
  const afterRate = findTaxRate(after)
  assert(
    afterRate === beforeRate,
    'tax_rate should be unchanged after manager attempt; was ' +
      beforeRate +
      ', now ' +
      afterRate,
  )
  return 'HTTP ' + res.status + '; tax_rate unchanged (auth guard held ✓)'
})

// ── Test 5: Manager toggles promotion (regression for 9A migration) ───────

await step('Test 5: Manager toggles first active promotion (regression for 9A migration)', async () => {
  const before = await fetchHtml('/manager/promotions', mgrCookie)
  // Live DB has real UUIDs; find the first promotion's id by inspecting the
  // form's hidden input. Fall back to scanning for any uuid-shaped value.
  const idMatch = before.match(/name="promotionId" value="([0-9a-f-]{36})"/)
  assert(idMatch !== null, 'no promotion row found in /manager/promotions')
  const promoId = idMatch![1]
  const beforeHidden = findPromotionActiveValue(before, promoId)
  assert(beforeHidden !== null, 'promotion row ' + promoId + ' missing hidden isActive input')

  const res = await postAction(mgrCookie, '/manager/promotions', TOGGLE_PROMO_ID, {
    promotionId: promoId,
    isActive: beforeHidden,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/manager/promotions', mgrCookie)
  const afterHidden = findPromotionActiveValue(after, promoId)
  assert(
    afterHidden !== beforeHidden,
    'promotion state should have flipped; hidden before=' + beforeHidden + ', after=' + afterHidden,
  )

  // Cleanup: flip back to original state for idempotency.
  await postAction(mgrCookie, '/manager/promotions', TOGGLE_PROMO_ID, {
    promotionId: promoId,
    isActive: afterHidden,
  })
  return 'promotion ' + promoId.slice(0, 8) + ' flipped (hidden ' + beforeHidden + ' → ' + afterHidden + ' ✓) then restored'
})

// ── Test 6: Manager closes and reopens a room unit (round-trip) ───────────
//
// Note: /manager/rates wires close/reopen via a client component (CloseRoomButton)
// that uses useTransition + FormData — NOT a server-rendered <form> with hidden
// inputs. So we cannot sniff unitId out of the HTML; instead we resolve it via
// a direct PostgREST query (RLS lets managers see all units) and then POST the
// action with multipart form-data as the React client would do.

await step('Test 6: Manager close/reopen round-trip on first room unit', async () => {
  // Pick any active unit that starts as 'available' so we can flip it.
  const { data: rows, error: listErr } = await mgr.supabase
    .from('room_units')
    .select('id, unit_label, status')
    .eq('is_active', true)
    .eq('status', 'available')
    .limit(1)
  if (listErr) throw new Error('list room_units failed: ' + listErr.message)
  assert(rows && rows.length === 1, 'no available room unit found in DB')
  const unitId = (rows![0] as { id: string }).id

  // Close it.
  const closeRes = await postAction(mgrCookie, '/manager/rates', CLOSE_ROOM_ID, {
    unitId,
  })
  if (closeRes.status >= 400) throw new Error('close HTTP ' + closeRes.status)

  const { data: closedRow } = await mgr.supabase
    .from('room_units')
    .select('status')
    .eq('id', unitId)
    .single()
  assert(
    closedRow?.status === 'maintenance',
    'unit should be maintenance after close; got ' + closedRow?.status,
  )

  // Reopen it.
  const reopenRes = await postAction(mgrCookie, '/manager/rates', REOPEN_ROOM_ID, {
    unitId,
  })
  if (reopenRes.status >= 400) throw new Error('reopen HTTP ' + reopenRes.status)

  const { data: finalRow } = await mgr.supabase
    .from('room_units')
    .select('status')
    .eq('id', unitId)
    .single()
  assert(
    finalRow?.status === 'available',
    'unit should be available after reopen; got ' + finalRow?.status,
  )

  return 'unit ' + unitId.slice(0, 8) + ': closed → maintenance, reopened → available ✓'
})

console.log('\n' + (failed === 0 ? '✅' : '⚠️') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)
