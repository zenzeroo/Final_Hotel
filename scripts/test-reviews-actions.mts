/**
 * Server-action smoke test for the Reviews & Ratings moderation queue.
 *
 * Tests the actual Next.js server actions over HTTP:
 *  - moderateReviewAction (approve)
 *  - hideReviewAction
 *  - unhideReviewAction
 *  - deleteReviewAction (admin-only)
 *
 * Strategy: same as test-manager-actions.mts —
 *   1. Sign in via @supabase/ssr to get cookies.
 *   2. Discover action IDs from `.next/dev/server/.../server-reference-manifest.json`.
 *   3. POST each action with multipart form-data using `$ACTION_ID_<id>` field.
 *   4. Re-fetch the page and verify mock state mutated via HTML delta.
 *
 * Mock state persists for the dev server's lifetime → tests use delta assertions.
 *
 * Prereqs:
 *  - `npm run dev` is running on http://localhost:3000
 *  - `.env.local` has USE_MOCK_DATA=1
 *
 * Run: npx tsx scripts/test-reviews-actions.mts
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
  process.stdout.write(`▶ ${name}\n`)
  try {
    const r = await fn()
    console.log(`  ✓ ${name}` + (r ? ` — ${r}` : ''))
    passed++
  } catch (e) {
    console.log(`  ✗ ${name} — ${(e as Error).message}`)
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
  return { cookies, supabase, cookieHeader: () => cookies.map((c) => `${c.name}=${c.value}`).join('; ') }
}

/** Discover action IDs from Next.js server-reference manifests. */
function discoverActionIds(): Record<string, string> {
  const serverDir = resolve(__dirname, '..', '.next', 'dev', 'server', 'app')
  const found: Record<string, string> = {}
  const paths = [
    resolve(serverDir, 'manager', 'reviews', 'page', 'server-reference-manifest.json'),
  ]
  for (const manifestPath of paths) {
    if (!existsSync(manifestPath)) continue
    const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      node?: Record<string, { exportedName?: string }>
    }
    for (const [id, info] of Object.entries(m.node ?? {})) {
      const name = info.exportedName
      if (name && !found[name]) found[name] = id
    }
  }
  return found
}

/** POST a server action with multipart form data, using `$ACTION_ID_<id>` field. */
async function postAction(
  cookieHeader: string,
  path: string,
  actionId: string,
  fields: Record<string, string>,
) {
  const boundary = '----ReviewsActionTest' + Date.now()
  const parts: Buffer[] = []
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="$ACTION_ID_${actionId}"\r\n\r\n\r\n`,
    ),
  )
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\n`))
    parts.push(Buffer.from(`Content-Disposition: form-data; name="${k}"\r\n\r\n`))
    parts.push(Buffer.from(v))
    parts.push(Buffer.from('\r\n'))
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  const body = Buffer.concat(parts)
  const res = await fetch(`${APP}${path}`, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
    redirect: 'manual',
  })
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text }
}

async function fetchHtml(path: string, cookie: string): Promise<string> {
  const res = await fetch(`${APP}${path}`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  return res.text()
}

// ── Sign in as manager ─────────────────────────────────────────────────────

const mgr = buildSession(MANAGER_EMAIL, MANAGER_PASSWORD)
await step('Sign in as manager', async () => {
  const { error, data } = await mgr.supabase.auth.signInWithPassword({
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return `uid=${data.user.id}`
})
const mgrCookie = mgr.cookieHeader()

// ── Discover action IDs ────────────────────────────────────────────────────

const ids = discoverActionIds()
const MODERATE_ID = ids.moderateReviewAction
const HIDE_ID = ids.hideReviewAction
const UNHIDE_ID = ids.unhideReviewAction
const DELETE_ID = ids.deleteReviewAction

await step('Discover server-action IDs', async () => {
  for (const [name, id] of [
    ['moderateReviewAction', MODERATE_ID],
    ['hideReviewAction', HIDE_ID],
    ['unhideReviewAction', UNHIDE_ID],
    ['deleteReviewAction', DELETE_ID],
  ] as const) {
    if (!id) throw new Error(`missing action: ${name}`)
  }
  return Object.entries(ids)
    .map(([k, v]) => `${k}=${v.slice(0, 8)}…`)
    .join(', ')
})

// ── Test 1: approve review (11111111-1111-1111-1111-000000000003 = Olivia) ──────────────────────────────

await step('Test 1: Approve Olivia Brown (11111111-1111-1111-1111-000000000003)', async () => {
  const before = await fetchHtml('/manager/reviews?tab=pending', mgrCookie)
  if (!before.includes('Olivia Brown')) {
    return `11111111-1111-1111-1111-000000000003 already approved in this dev session — skipped`
  }

  const res = await postAction(mgrCookie, '/manager/reviews', MODERATE_ID, {
    reviewId: '11111111-1111-1111-1111-000000000003',
  })
  if (res.status >= 400) throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 200)}`)

  const after = await fetchHtml('/manager/reviews?tab=pending', mgrCookie)
  assert(!after.includes('Olivia Brown'), 'Olivia still pending after approve')
  const approved = await fetchHtml('/manager/reviews?tab=approved', mgrCookie)
  assert(approved.includes('Olivia Brown'), 'Olivia missing from approved tab after approve')
  return `Olivia moved pending → approved ✓`
})

// ── Test 2: hide review (11111111-1111-1111-1111-000000000001 = Eleanor) ───────────────────────────────

await step('Test 2: Hide Eleanor Smith (11111111-1111-1111-1111-000000000001)', async () => {
  const before = await fetchHtml('/manager/reviews?tab=approved', mgrCookie)
  if (!before.includes('Eleanor Smith')) {
    return `11111111-1111-1111-1111-000000000001 already hidden — skipped`
  }

  const res = await postAction(mgrCookie, '/manager/reviews', HIDE_ID, {
    reviewId: '11111111-1111-1111-1111-000000000001',
  })
  if (res.status >= 400) throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 200)}`)

  const hidden = await fetchHtml('/manager/reviews?tab=hidden', mgrCookie)
  assert(hidden.includes('Eleanor Smith'), 'Eleanor missing from hidden tab after hide')

  const approved = await fetchHtml('/manager/reviews?tab=approved', mgrCookie)
  assert(!approved.includes('Eleanor Smith'), 'Eleanor still in approved tab after hide')
  return `Eleanor moved approved → hidden ✓`
})

// ── Test 3: unhide review (11111111-1111-1111-1111-000000000006 = Markus) ──────────────────────────────

await step('Test 3: Unhide Markus Schneider (11111111-1111-1111-1111-000000000006)', async () => {
  const before = await fetchHtml('/manager/reviews?tab=hidden', mgrCookie)
  if (!before.includes('Markus Schneider')) {
    return `11111111-1111-1111-1111-000000000006 not in hidden tab — skipped`
  }

  const res = await postAction(mgrCookie, '/manager/reviews', UNHIDE_ID, {
    reviewId: '11111111-1111-1111-1111-000000000006',
  })
  if (res.status >= 400) throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 200)}`)

  const hidden = await fetchHtml('/manager/reviews?tab=hidden', mgrCookie)
  assert(!hidden.includes('Markus Schneider'), 'Markus still in hidden tab after unhide')

  const approved = await fetchHtml('/manager/reviews?tab=approved', mgrCookie)
  assert(approved.includes('Markus Schneider'), 'Markus missing from approved tab after unhide')
  return `Markus moved hidden → approved ✓`
})

// ── Test 4: delete review (auth guard — manager cannot) ────────────────────

await step('Test 4: Auth guard — manager cannot delete (11111111-1111-1111-1111-000000000005)', async () => {
  const beforeApproved = await fetchHtml('/manager/reviews?tab=approved', mgrCookie)
  if (!beforeApproved.includes('Sofia Petrova')) {
    return `11111111-1111-1111-1111-000000000005 already deleted — skipped`
  }

  const res = await postAction(mgrCookie, '/manager/reviews', DELETE_ID, {
    reviewId: '11111111-1111-1111-1111-000000000005',
  })
  if (res.status >= 500) throw new Error(`server crashed: ${res.status}`)

  // Manager is not admin → action returns ok:false (no redirect; requireAdmin redirects to /).
  // Either way, 11111111-1111-1111-1111-000000000005 should STILL be present in approved tab.
  const after = await fetchHtml('/manager/reviews?tab=approved', mgrCookie)
  assert(after.includes('Sofia Petrova'), 'manager deleted review (admin-only guard failed)')
  return `HTTP ${res.status}; 11111111-1111-1111-1111-000000000005 still present (auth guard held ✓)`
})

// ── Test 5: delete review (admin can) — skipped if admin not seeded ───────

let adminAvailable = false
const adm = buildSession(ADMIN_EMAIL, ADMIN_PASSWORD)
await step('Sign in as admin', async () => {
  const { error, data } = await adm.supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  if (error || !data.user) {
    return `admin user not seeded in this dev environment — Test 5 skipped`
  }
  adminAvailable = true
  return `uid=${data.user.id}`
})

if (adminAvailable) {
  const admCookie = adm.cookieHeader()
  await step('Test 5: Admin deletes Sofia Petrova (11111111-1111-1111-1111-000000000005)', async () => {
    const before = await fetchHtml('/manager/reviews?tab=approved', admCookie)
    if (!before.includes('Sofia Petrova')) {
      return `11111111-1111-1111-1111-000000000005 already deleted — skipped`
    }

    const res = await postAction(admCookie, '/manager/reviews', DELETE_ID, {
      reviewId: '11111111-1111-1111-1111-000000000005',
    })
    if (res.status >= 400) throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 200)}`)

    const after = await fetchHtml('/manager/reviews?tab=approved', admCookie)
    assert(!after.includes('Sofia Petrova'), 'Sofia still present after admin delete')
    return `11111111-1111-1111-1111-000000000005 deleted by admin ✓`
  })
}

console.log(`\n${failed === 0 ? '✅' : '⚠️'}  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
