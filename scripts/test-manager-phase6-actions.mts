/**
 * Server-action smoke test for Phase 6 (1C promotions + 1E rates).
 *
 * Tests the actual Next.js server actions over HTTP:
 *  - togglePromotionAction  (app/actions/promotions.ts)
 *  - closeRoomAction        (app/actions/rates.ts)
 *  - reopenRoomAction       (app/actions/rates.ts)
 *
 * Strategy: same as test-manager-actions.mts —
 *   1. Sign in via @supabase/ssr to get cookies.
 *   2. Discover action IDs from .next/dev/server/.../server-reference-manifest.json.
 *   3. POST each action with multipart form-data using the ACTION_ID field name.
 *   4. Re-fetch the page and verify mock state mutated via HTML delta.
 *
 * Mock state persists for the dev server's lifetime, so tests use delta
 * assertions and skip if a record was already actioned in a previous run.
 *
 * Prereqs:
 *  - `npm run dev` is running on http://localhost:3000
 *  - `.env.local` has USE_MOCK_DATA=1
 *
 * Run: npx tsx scripts/test-manager-phase6-actions.mts
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
const HOUSEKEEPER_EMAIL = 'somjit@zenzero.com'
const HOUSEKEEPER_PASSWORD = process.env.HOUSEKEEPER_TEST_PASSWORD ?? 'Housekeep123!'

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
// FIRST field name "ACTION_ID_<id>" with empty value, followed by the form fields.
async function postAction(
  cookieHeader: string,
  path: string,
  actionId: string,
  fields: Record<string, string>,
) {
  const boundary = '----Phase6ActionTest' + Date.now()
  const parts: Buffer[] = []
  // Build the action-marker field via concat (avoids template-literal gotchas).
  // Field name MUST start with "$" — see memory: Next.js 16 server actions read
  // the action id out of "$ACTION_ID_<id>" form fields, not the Next-Action header.
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

// Find the hidden isActive value inside the toggle form for a given promotion id.
// The TogglePromotionButton renders a hidden input whose value is the OPPOSITE of
// the current state — so if current is_active=true, the hidden input is "false"
// (because clicking would set it to false). This means: sending `hiddenValue` as
// `isActive` to the action FLIPS the state. After the action, hiddenValue flips too.
// Returns "true" | "false" | null (null = row not found).
function findPromotionActiveValue(html: string, promoId: string): string | null {
  // Split on form close to avoid regex matching across form boundaries.
  // Each `<form ...>...</form>` becomes one element; we scan for the promo id.
  const forms = html.split(/<\/form>/)
  for (const chunk of forms) {
    if (!chunk.includes('value="' + promoId + '"')) continue
    const v = chunk.match(/name="isActive" value="(true|false)"/)
    if (v) return v[1]
  }
  return null
}

// Find the status chip text for a given unit label (room number).
// Returns one of the Thai status labels, or null if row not found.
function findUnitStatus(html: string, unitLabel: string): string | null {
  const re = new RegExp('<tr[^>]*>[\\s\\S]*?>' + unitLabel + '<[\\s\\S]*?</tr>')
  const row = html.match(re)?.[0]
  if (!row) return null
  // Longest first to avoid partial matches (substring of "กำลังทำความสะอาด")
  const labels = [
    'กำลังทำความสะอาด',
    'ปิดซ่อมบำรุง',
    'ปิดใช้งาน',
    'ว่าง',
    'มีแขก',
  ]
  for (const label of labels) {
    if (row.includes(label)) return label
  }
  return null
}

// ── Sign in as manager ──────────────────────────────────────────────────────

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

// Precompile new routes so manifests exist before discovery.
// Next.js dev mode compiles lazily on first request.
await step('Precompile /manager/promotions and /manager/rates', async () => {
  const r1 = await fetch(APP + '/manager/promotions', { headers: { Cookie: mgrCookie } })
  const r2 = await fetch(APP + '/manager/rates', { headers: { Cookie: mgrCookie } })
  return 'promotions=' + r1.status + ', rates=' + r2.status
})

// ── Discover action IDs ────────────────────────────────────────────────────

const ids = discoverActionIds()
const TOGGLE_PROMO_ID = ids.togglePromotionAction
const CLOSE_ROOM_ID = ids.closeRoomAction
const REOPEN_ROOM_ID = ids.reopenRoomAction

await step('Discover server-action IDs', async () => {
  for (const [name, id] of [
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

// ── Test 1: toggle p-003 (SUMMER25, expired + inactive by default) ─────────

await step('Test 1: Toggle p-003 SUMMER25 (inactive → active)', async () => {
  const before = await fetchHtml('/manager/promotions', mgrCookie)
  const beforeHidden = findPromotionActiveValue(before, 'p-003')
  assert(beforeHidden !== null, 'p-003 row not found in promotions table')
  // The hidden input = OPPOSITE of current state. Submitting it as `isActive`
  // flips the current state. After flipping, the hidden input value flips too.
  const res = await postAction(mgrCookie, '/manager/promotions', TOGGLE_PROMO_ID, {
    promotionId: 'p-003',
    isActive: beforeHidden,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/manager/promotions', mgrCookie)
  const afterHidden = findPromotionActiveValue(after, 'p-003')
  assert(
    afterHidden !== beforeHidden,
    'p-003 state should have flipped; hidden before=' + beforeHidden + ', after=' + afterHidden,
  )
  return 'p-003 flipped (hidden ' + beforeHidden + ' → ' + afterHidden + ') ✓'
})

// ── Test 2: toggle p-003 BACK to its starting state (cleanup) ───────────────

await step('Test 2: Toggle p-003 back to starting state', async () => {
  const before = await fetchHtml('/manager/promotions', mgrCookie)
  const beforeHidden = findPromotionActiveValue(before, 'p-003')
  assert(beforeHidden !== null, 'p-003 row missing after Test 1')
  // Same pattern as Test 1: sending the current hidden value flips the state.
  const res = await postAction(mgrCookie, '/manager/promotions', TOGGLE_PROMO_ID, {
    promotionId: 'p-003',
    isActive: beforeHidden,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))
  const after = await fetchHtml('/manager/promotions', mgrCookie)
  const afterHidden = findPromotionActiveValue(after, 'p-003')
  assert(
    afterHidden !== beforeHidden,
    'p-003 cleanup should flip; hidden before=' + beforeHidden + ', after=' + afterHidden,
  )
  return 'p-003 flipped back (hidden ' + beforeHidden + ' → ' + afterHidden + ') ✓'
})

// ── Test 3: validation — empty promotionId returns ok:false, no state change ──────

await step('Test 3: Validation — empty promotionId (action returns ok:false)', async () => {
  const before = await fetchHtml('/manager/promotions', mgrCookie)
  const beforeActive = findPromotionActiveValue(before, 'p-001')
  assert(beforeActive !== null, 'p-001 row missing before invalid call')

  const res = await postAction(mgrCookie, '/manager/promotions', TOGGLE_PROMO_ID, {
    promotionId: '',
    isActive: 'true',
  })
  // Server-action returns ok:false without mutating. We expect no 5xx.
  assert(res.status < 500, 'server crashed on invalid input: ' + res.status)

  const after = await fetchHtml('/manager/promotions', mgrCookie)
  const afterActive = findPromotionActiveValue(after, 'p-001')
  assert(
    afterActive === beforeActive,
    'p-001 should be unchanged; was ' + beforeActive + ', now ' + afterActive,
  )
  return 'HTTP ' + res.status + '; p-001 unchanged (validation held ✓)'
})

// ── Test 4: close room u-102 (currently available → maintenance) ────────────

await step('Test 4: Close room u-102 (available → maintenance)', async () => {
  const before = await fetchHtml('/manager/rates', mgrCookie)
  const beforeStatus = findUnitStatus(before, '102')
  assert(beforeStatus !== null, 'room 102 row not found')
  if (beforeStatus !== 'ว่าง') {
    return 'room 102 not available (already ' + beforeStatus + ') — skipped (mock state persists)'
  }

  const res = await postAction(mgrCookie, '/manager/rates', CLOSE_ROOM_ID, {
    unitId: 'u-102',
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/manager/rates', mgrCookie)
  const afterStatus = findUnitStatus(after, '102')
  assert(
    afterStatus === 'ปิดซ่อมบำรุง',
    'room 102 should now show "ปิดซ่อมบำรุง"; got ' + afterStatus,
  )
  return 'room 102 closed: ' + beforeStatus + ' → ' + afterStatus + ' ✓'
})

// ── Test 5: reopen room u-104 (currently maintenance → available) ───────────

await step('Test 5: Reopen room u-104 (maintenance → available)', async () => {
  const before = await fetchHtml('/manager/rates', mgrCookie)
  const beforeStatus = findUnitStatus(before, '104')
  assert(beforeStatus !== null, 'room 104 row not found')
  if (beforeStatus !== 'ปิดซ่อมบำรุง') {
    return 'room 104 not maintenance (already ' + beforeStatus + ') — skipped (mock state persists)'
  }

  const res = await postAction(mgrCookie, '/manager/rates', REOPEN_ROOM_ID, {
    unitId: 'u-104',
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/manager/rates', mgrCookie)
  const afterStatus = findUnitStatus(after, '104')
  assert(
    afterStatus === 'ว่าง',
    'room 104 should now show "ว่าง"; got ' + afterStatus,
  )
  return 'room 104 reopened: ' + beforeStatus + ' → ' + afterStatus + ' ✓'
})

// ── Test 6: auth guard — housekeeper cannot toggle promotion ────────────────

await step('Test 6: Auth guard — housekeeper cannot toggle promotion', async () => {
  const hk = buildSession(HOUSEKEEPER_EMAIL, HOUSEKEEPER_PASSWORD)
  const { error, data } = await hk.supabase.auth.signInWithPassword({
    email: HOUSEKEEPER_EMAIL,
    password: HOUSEKEEPER_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')

  // Snapshot p-001 (EARLY15) — housekeeper should NOT be able to flip it
  const before = await fetchHtml('/manager/promotions', mgrCookie)
  const beforeActive = findPromotionActiveValue(before, 'p-001')
  assert(beforeActive !== null, 'p-001 row missing')

  const res = await postAction(hk.cookieHeader(), '/manager/promotions', TOGGLE_PROMO_ID, {
    promotionId: 'p-001',
    isActive: beforeActive === 'true' ? 'false' : 'true',
  })
  // requirePromotionManager redirects non-manager → action does NOT throw.
  // We just check no mutation: p-001 should still be in its starting state.
  if (res.status >= 500) throw new Error('server crashed: ' + res.status)

  const after = await fetchHtml('/manager/promotions', mgrCookie)
  const afterActive = findPromotionActiveValue(after, 'p-001')
  assert(
    afterActive === beforeActive,
    'p-001 should be unchanged by housekeeper; was ' + beforeActive + ', now ' + afterActive,
  )
  return 'HTTP ' + res.status + '; p-001 unchanged by housekeeper (auth guard held ✓)'
})

// ── Test 7: auth guard — housekeeper cannot close room ──────────────────────

await step('Test 7: Auth guard — housekeeper cannot close room', async () => {
  const hk = buildSession(HOUSEKEEPER_EMAIL, HOUSEKEEPER_PASSWORD)
  const { error } = await hk.supabase.auth.signInWithPassword({
    email: HOUSEKEEPER_EMAIL,
    password: HOUSEKEEPER_PASSWORD,
  })
  if (error) throw new Error(error.message)

  // Snapshot u-103 (Botanic King, currently cleaning) — close as housekeeper
  const before = await fetchHtml('/manager/rates', mgrCookie)
  const beforeStatus = findUnitStatus(before, '103')
  assert(beforeStatus !== null, 'room 103 row missing')

  const res = await postAction(hk.cookieHeader(), '/manager/rates', CLOSE_ROOM_ID, {
    unitId: 'u-103',
  })
  if (res.status >= 500) throw new Error('server crashed: ' + res.status)

  const after = await fetchHtml('/manager/rates', mgrCookie)
  const afterStatus = findUnitStatus(after, '103')
  assert(
    afterStatus === beforeStatus,
    'room 103 should be unchanged by housekeeper; was ' + beforeStatus + ', now ' + afterStatus,
  )
  return 'HTTP ' + res.status + '; room 103 unchanged (auth guard held ✓)'
})

console.log('\n' + (failed === 0 ? '✅' : '⚠️') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)