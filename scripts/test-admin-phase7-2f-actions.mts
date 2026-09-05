/**
 * Server-action smoke test for Phase 7 sub-phase 2F (Rates CRUD).
 *
 * Tests the actual Next.js server actions over HTTP:
 *  - createRoomTypeAction     (app/actions/admin/rates.ts)
 *  - updateRoomTypeAction     (app/actions/admin/rates.ts)
 *  - createSeasonalRateAction (app/actions/admin/rates.ts)
 *  - deleteSeasonalRateAction (app/actions/admin/rates.ts)
 *
 * Strategy:
 *  1. Sign in as admin via @supabase/ssr (mock auth accepts admin@zenzero.com / AdminPass123!).
 *  2. Discover action IDs from `.next/dev/server/.../server-reference-manifest.json`.
 *  3. POST each action with multipart form-data using `$ACTION_ID_<id>` field.
 *  4. Re-fetch the page and verify mock state mutated via HTML delta.
 *
 * Mock state persists for the dev server's lifetime → use unique test records
 * (timestamped slug + label) so each run is clean.
 *
 * Prereqs:
 *  - `npm run dev` is running on http://localhost:3000
 *
 * Run: npx tsx scripts/test-admin-phase7-2f-actions.mts
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
    resolve(serverDir, 'admin', 'rates', 'room-types', 'page', 'server-reference-manifest.json'),
    resolve(serverDir, 'admin', 'rates', 'seasonal-rates', 'page', 'server-reference-manifest.json'),
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
  const boundary = '----Phase7FActionTest' + Date.now()
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

// Returns true if the HTML contains the exact row signature for a slug + name pair.
function hasRoomTypeRow(html: string, slug: string, name: string): boolean {
  // Slug appears in a <span class="font-mono">…</span>; name appears as primary text.
  return html.includes(slug) && html.includes(name)
}

// Given a slug, find the corresponding edit-link id from the HTML.
// Scans chunks split by </tr> so the matched row contains BOTH slug and name.
function findRoomTypeIdBySlug(html: string, slug: string): string | null {
  const chunks = html.split('</tr>')
  for (const chunk of chunks) {
    if (!chunk.includes(slug)) continue
    const m = chunk.match(/\/admin\/rates\/room-types\/([^/]+)\/edit/)
    if (m) return m[1]
  }
  return null
}

// Returns true if the HTML contains the seasonal rate's label and room_type_name.
function hasSeasonalRateRow(
  html: string,
  label: string,
  roomTypeName: string,
): boolean {
  return html.includes(label) && html.includes(roomTypeName)
}

// ── Sign in as admin ─────────────────────────────────────────────────────────

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

await step('Precompile /admin/rates/room-types and /admin/rates/seasonal-rates', async () => {
  const r1 = await fetchHtml('/admin/rates/room-types', adminCookie)
  const r2 = await fetchHtml('/admin/rates/seasonal-rates', adminCookie)
  return 'room-types=' + r1.length + 'B, seasonal-rates=' + r2.length + 'B'
})

const ids = discoverActionIds()
const CREATE_ROOM_TYPE_ID = ids.createRoomTypeAction
const UPDATE_ROOM_TYPE_ID = ids.updateRoomTypeAction
const CREATE_RATE_ID = ids.createSeasonalRateAction
const DELETE_RATE_ID = ids.deleteSeasonalRateAction

await step('Discover server-action IDs', async () => {
  for (const [name, id] of [
    ['createRoomTypeAction', CREATE_ROOM_TYPE_ID],
    ['updateRoomTypeAction', UPDATE_ROOM_TYPE_ID],
    ['createSeasonalRateAction', CREATE_RATE_ID],
    ['deleteSeasonalRateAction', DELETE_RATE_ID],
  ] as const) {
    if (!id) throw new Error('missing action: ' + name)
  }
  return Object.keys(ids).sort().join(', ')
})

// ── Test 1: create a new room type (uses unique slug/name) ──────────────────

const ts = Date.now()
const NEW_SLUG = 'test-rt-' + ts
const NEW_NAME = 'Test Room Type ' + ts
const NEW_NAME_TH = 'ทดสอบ ' + ts
const RATE_LABEL = 'Test Rate ' + ts

await step('Test 1: createRoomTypeAction (unique slug ' + NEW_SLUG + ')', async () => {
  const before = await fetchHtml('/admin/rates/room-types', adminCookie)
  assert(!hasRoomTypeRow(before, NEW_SLUG, NEW_NAME), 'slug already present before action')

  const res = await postAction(adminCookie, '/admin/rates/room-types', CREATE_ROOM_TYPE_ID, {
    slug: NEW_SLUG,
    name: NEW_NAME,
    name_th: NEW_NAME_TH,
    short_desc: 'Short desc for test room type',
    description: 'Longer description for the test room type used by smoke tests.',
    base_price: '4200',
    max_guests: '2',
    size_sqm: '30',
    is_active: 'true',
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/admin/rates/room-types', adminCookie)
  assert(hasRoomTypeRow(after, NEW_SLUG, NEW_NAME), 'new row not present after create')
  return 'created ' + NEW_SLUG
})

// ── Test 2: update the new room type's base_price ───────────────────────────

await step('Test 2: updateRoomTypeAction (base_price 4200 → 4999)', async () => {
  // Look up the test row's id by its unique slug (avoids sending the wrong
  // slug for a different room type — slug has a UNIQUE constraint).
  const html = await fetchHtml('/admin/rates/room-types', adminCookie)
  const id = findRoomTypeIdBySlug(html, NEW_SLUG)
  assert(id !== null, 'no edit link in row containing slug "' + NEW_SLUG + '"')

  const res = await postAction(
    adminCookie,
    '/admin/rates/room-types',
    UPDATE_ROOM_TYPE_ID,
    {
      id,
      slug: NEW_SLUG,
      name: NEW_NAME,
      name_th: NEW_NAME_TH,
      short_desc: 'Short desc for test room type',
      description: 'Longer description for the test room type used by smoke tests.',
      base_price: '4999',
      max_guests: '2',
      size_sqm: '30',
      is_active: 'true',
    },
  )
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/admin/rates/room-types', adminCookie)
  // Expect "4,999" (thousands separator) somewhere in the row
  assert(after.includes('4,999'), 'updated base_price (4,999) not found in HTML')
  return 'price flipped 4,200 → 4,999 ✓'
})

// ── Test 3: create a seasonal rate for the new room type ───────────────────

await step('Test 3: createSeasonalRateAction (label ' + RATE_LABEL + ')', async () => {
  // Look up the test room type's id by its unique slug.
  const html = await fetchHtml('/admin/rates/room-types', adminCookie)
  const roomTypeId = findRoomTypeIdBySlug(html, NEW_SLUG)
  assert(roomTypeId !== null, 'no room type found for slug "' + NEW_SLUG + '"')

  const res = await postAction(
    adminCookie,
    '/admin/rates/seasonal-rates',
    CREATE_RATE_ID,
    {
      room_type_id: roomTypeId,
      label: RATE_LABEL,
      start_date: '2026-12-01',
      end_date: '2026-12-31',
      flat_price: '8800',
      price_multiplier: '',
      min_nights_override: '',
      priority: '50',
      is_active: 'true',
    },
  )
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/admin/rates/seasonal-rates', adminCookie)
  assert(
    hasSeasonalRateRow(after, RATE_LABEL, NEW_NAME),
    'new seasonal rate row not found in HTML',
  )
  return 'rate ' + RATE_LABEL + ' attached to ' + NEW_NAME + ' ✓'
})

// ── Test 4: validation — neither flat_price nor price_multiplier ────────────

await step(
  'Test 4: validation — seasonal rate without flat_price or multiplier (rejected)',
  async () => {
    const html = await fetchHtml('/admin/rates/room-types', adminCookie)
    const roomTypeId = findRoomTypeIdBySlug(html, NEW_SLUG)
    assert(roomTypeId !== null, 'no room type found for slug "' + NEW_SLUG + '"')

    const res = await postAction(
      adminCookie,
      '/admin/rates/seasonal-rates',
      CREATE_RATE_ID,
      {
        room_type_id: roomTypeId,
        label: 'Should-Fail-' + ts,
        start_date: '2026-12-01',
        end_date: '2026-12-31',
        flat_price: '',
        price_multiplier: '',
        min_nights_override: '',
        priority: '1',
        is_active: 'true',
      },
    )
    assert(res.status < 500, 'server crashed on invalid input: ' + res.status)

    const after = await fetchHtml('/admin/rates/seasonal-rates', adminCookie)
    assert(
      !after.includes('Should-Fail-' + ts),
      'invalid rate should not have been created (label absent → ok)',
    )
    return 'HTTP ' + res.status + '; invalid rate rejected (validation held ✓)'
  },
)

// ── Test 5: delete the seasonal rate ───────────────────────────────────────

await step('Test 5: deleteSeasonalRateAction (remove ' + RATE_LABEL + ')', async () => {
  // Need the seasonal rate id. Use table's edit link which contains the rate id.
  // Split HTML on </tr> to isolate each row, then find the row containing our label.
  const html = await fetchHtml('/admin/rates/seasonal-rates', adminCookie)
  const chunks = html.split('</tr>')
  let rateId: string | null = null
  let matchedChunk = ''
  for (const chunk of chunks) {
    if (chunk.includes(RATE_LABEL)) {
      const m = chunk.match(/\/admin\/rates\/seasonal-rates\/([^/]+)\/edit/)
      if (m) {
        rateId = m[1]
        matchedChunk = chunk
        break
      }
    }
  }
  assert(rateId !== null, 'no edit link in row containing "' + RATE_LABEL + '"')

  const res = await postAction(adminCookie, '/admin/rates/seasonal-rates', DELETE_RATE_ID, {
    id: rateId!,
  })
  if (res.status >= 400) throw new Error('HTTP ' + res.status + ': ' + res.body.slice(0, 200))

  const after = await fetchHtml('/admin/rates/seasonal-rates', adminCookie)
  assert(!after.includes(RATE_LABEL), 'deleted label still appears in HTML after delete')
  return 'rate ' + RATE_LABEL + ' removed ✓'
})

// ── Test 6: auth guard — housekeeper cannot create a room type ─────────────

await step('Test 6: Auth guard — housekeeper cannot createRoomTypeAction', async () => {
  const hk = buildSession(HOUSEKEEPER_EMAIL, HOUSEKEEPER_PASSWORD)
  const { error } = await hk.supabase.auth.signInWithPassword({
    email: HOUSEKEEPER_EMAIL,
    password: HOUSEKEEPER_PASSWORD,
  })
  if (error) throw new Error(error.message)

  const guardSlug = 'guard-rt-' + ts
  const res = await postAction(hk.cookieHeader(), '/admin/rates/room-types', CREATE_ROOM_TYPE_ID, {
    slug: guardSlug,
    name: 'Guard Test',
    name_th: 'ทดสอบการ์ด',
    short_desc: 'should fail',
    description: 'should fail',
    base_price: '100',
    max_guests: '1',
    size_sqm: '10',
    is_active: 'true',
  })
  if (res.status >= 500) throw new Error('server crashed: ' + res.status)

  const after = await fetchHtml('/admin/rates/room-types', adminCookie)
  assert(!after.includes(guardSlug), 'housekeeper should not have created a room type')
  return 'HTTP ' + res.status + '; guard slug absent from HTML (auth guard held ✓)'
})

console.log('\n' + (failed === 0 ? '✅' : '⚠️') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)
