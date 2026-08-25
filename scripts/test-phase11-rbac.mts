/**
 * Phase 11 — Role-Based Access Control live-DB smoke test.
 *
 * Verifies that staff can't slip into User pages and vice-versa after the
 * Phase 11 fix. Each test signs in as a role via @supabase/ssr, then GETs a
 * path and asserts the redirect target / 200 OK.
 *
 * Covers:
 *   - proxy.ts staff role gates        → wrong-role staff → their own dashboard
 *   - proxy.ts authPages redirect      → authed user on /login → role home
 *   - app/(booking)/layout.tsx gate    → /bookings/* is User-only
 *   - 4 staff portal layouts           → wrong-role redirects to own dashboard
 *   - public pages (/, /rooms)         → accessible to all signed-in users
 *   - admin = superuser                → admin can hit any staff portal
 *
 * Strategy:
 *   1. Sign in 5 roles via @supabase/ssr cookies.
 *   2. For each (role, path, expected) tuple, do fetch() with redirect:'manual'
 *      and assert the final Location header.
 *
 * Prereqs:
 *   - `npm run dev` is running on http://localhost:3000
 *   - `.env.local` has USE_MOCK_DATA=0 (real auth + RLS)
 *   - Seed users exist:
 *       admin@zenzero.com / AdminPass123!
 *       manager@zenzero.com / ManagerPass123!
 *       reception@zenzero.com / ReceptionPass123!
 *       somjit@zenzero.com / Housekeep123!
 *       test@zenzero.com / TestPass123!
 *
 * Run: npx tsx scripts/test-phase11-rbac.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const APP = 'http://localhost:3000'

const ROLES = {
  admin: { email: 'admin@zenzero.com', password: process.env.ADMIN_TEST_PASSWORD ?? 'AdminPass123!' },
  manager: { email: 'manager@zenzero.com', password: process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!' },
  reception: { email: 'reception@zenzero.com', password: process.env.RECEPTION_TEST_PASSWORD ?? 'ReceptionPass123!' },
  housekeeper: { email: 'somjit@zenzero.com', password: process.env.HOUSEKEEPER_TEST_PASSWORD ?? 'Housekeep123!' },
  user: { email: 'test@zenzero.com', password: process.env.USER_TEST_PASSWORD ?? 'TestPass123!' },
} as const

type Role = keyof typeof ROLES
type RoleHome = { admin: '/admin'; manager: '/manager'; reception: '/reception'; housekeeper: '/housekeeper'; user: '/' }
const HOME: RoleHome = { admin: '/admin', manager: '/manager', reception: '/reception', housekeeper: '/housekeeper', user: '/' }

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
  const supabase = createServerClient(BASE, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
  return { cookies, supabase, cookieHeader: () => cookies.map((c) => c.name + '=' + c.value).join('; ') }
}

// Follow redirects manually so we can assert the final Location header.
async function fetchFinal(cookie: string | null, path: string): Promise<{ status: number; location: string | null }> {
  const headers: Record<string, string> = {}
  if (cookie) headers.Cookie = cookie
  const res = await fetch(APP + path, { headers, redirect: 'manual' })
  return { status: res.status, location: res.headers.get('location') }
}

// ── Sign in all 5 roles ────────────────────────────────────────────────────

const sessions: Record<Role, string> = {} as Record<Role, string>

for (const role of Object.keys(ROLES) as Role[]) {
  const { email, password } = ROLES[role]
  const sess = buildSession(email, password)
  await step('Sign in as ' + role, async () => {
    const { error, data } = await sess.supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('no user')
    sessions[role] = sess.cookieHeader()
    return 'uid=' + data.user.id.slice(0, 8) + '…'
  })
}

// ── Precompile the routes we'll hit so server builds cache ────────────────

await step('Precompile /, /rooms, /bookings, /admin, /reception, /manager, /housekeeper', async () => {
  const paths = ['/', '/rooms', '/bookings', '/admin', '/reception', '/manager', '/housekeeper']
  const statuses: string[] = []
  for (const p of paths) {
    const r = await fetch(APP + p, { headers: { Cookie: sessions.user }, redirect: 'manual' })
    statuses.push(p + '=' + r.status)
  }
  return statuses.join(', ')
})

// ── Helpers ────────────────────────────────────────────────────────────────

function expectRedirect(cookie: string, path: string, expectedPath: string, label: string) {
  return step(label, async () => {
    const r = await fetchFinal(cookie, path)
    assert(
      r.status === 307 || r.status === 308 || r.status === 303 || r.status === 302,
      'expected redirect (3xx); got ' + r.status,
    )
    const loc = r.location ?? ''
    // Strip optional ?next= query string so "/login?next=/x" matches "/login".
    const locPath = loc.split('?')[0]
    assert(
      locPath === expectedPath || loc.endsWith(expectedPath),
      'expected Location ending with "' + expectedPath + '"; got "' + loc + '" (status=' + r.status + ')',
    )
    return expectedPath
  })
}

function expectOk(cookie: string, path: string, label: string) {
  return step(label, async () => {
    const r = await fetchFinal(cookie, path)
    assert(r.status === 200, 'expected 200; got ' + r.status + ' (location=' + r.location + ')')
    return '200 OK'
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Authed user on /login → role-specific dashboard (proxy authPages) ──

await expectRedirect(sessions.user, '/login', HOME.user, 'user cookie → /login redirects to /')
await expectRedirect(sessions.reception, '/login', HOME.reception, 'reception cookie → /login redirects to /reception')
await expectRedirect(sessions.housekeeper, '/login', HOME.housekeeper, 'housekeeper cookie → /login redirects to /housekeeper')
await expectRedirect(sessions.manager, '/login', HOME.manager, 'manager cookie → /login redirects to /manager')
await expectRedirect(sessions.admin, '/login', HOME.admin, 'admin cookie → /login redirects to /admin')

// ── 2. Public pages accessible to all signed-in roles ──

await expectOk(sessions.user, '/', 'user → / is 200')
await expectOk(sessions.reception, '/', 'reception → / is 200 (public)')
await expectOk(sessions.manager, '/', 'manager → / is 200 (public)')
await expectOk(sessions.user, '/rooms', 'user → /rooms is 200')
await expectOk(sessions.reception, '/rooms', 'reception → /rooms is 200 (public)')
await expectOk(sessions.manager, '/rooms', 'manager → /rooms is 200 (public)')

// ── 3. Own-portal sanity (sanity, no redirect) ──

await expectOk(sessions.user, '/bookings', 'user → /bookings is 200')
await expectOk(sessions.reception, '/reception', 'reception → /reception is 200')
await expectOk(sessions.housekeeper, '/housekeeper', 'housekeeper → /housekeeper is 200')
await expectOk(sessions.manager, '/manager', 'manager → /manager is 200')
await expectOk(sessions.admin, '/admin', 'admin → /admin is 200')

// ── 4. User blocked from staff portals (proxy staff gates) ──

await expectRedirect(sessions.user, '/admin', HOME.user, 'user → /admin redirects to /')
await expectRedirect(sessions.user, '/manager', HOME.user, 'user → /manager redirects to /')
await expectRedirect(sessions.user, '/reception', HOME.user, 'user → /reception redirects to /')
await expectRedirect(sessions.user, '/housekeeper', HOME.user, 'user → /housekeeper redirects to /')

// ── 5. Wrong-role staff → own dashboard (Phase 11 critical fix) ──

await expectRedirect(sessions.reception, '/admin', HOME.reception, 'reception → /admin redirects to /reception')
await expectRedirect(sessions.reception, '/manager', HOME.reception, 'reception → /manager redirects to /reception')
await expectRedirect(sessions.reception, '/housekeeper', HOME.reception, 'reception → /housekeeper redirects to /reception')
await expectRedirect(sessions.housekeeper, '/admin', HOME.housekeeper, 'housekeeper → /admin redirects to /housekeeper')
await expectRedirect(sessions.housekeeper, '/reception', HOME.housekeeper, 'housekeeper → /reception redirects to /housekeeper')
await expectRedirect(sessions.housekeeper, '/manager', HOME.housekeeper, 'housekeeper → /manager redirects to /housekeeper')
await expectRedirect(sessions.manager, '/admin', HOME.manager, 'manager → /admin redirects to /manager')
await expectRedirect(sessions.manager, '/reception', HOME.manager, 'manager → /reception redirects to /manager')
await expectRedirect(sessions.manager, '/housekeeper', HOME.manager, 'manager → /housekeeper redirects to /manager')

// ── 6. Staff blocked from /bookings/* (booking layout gate) ──

await expectRedirect(sessions.reception, '/bookings', HOME.reception, 'reception → /bookings redirects to /reception')
await expectRedirect(sessions.housekeeper, '/bookings', HOME.housekeeper, 'housekeeper → /bookings redirects to /housekeeper')
await expectRedirect(sessions.manager, '/bookings', HOME.manager, 'manager → /bookings redirects to /manager')
await expectRedirect(sessions.reception, '/bookings/new', HOME.reception, 'reception → /bookings/new redirects to /reception')
await expectRedirect(sessions.housekeeper, '/bookings/new', HOME.housekeeper, 'housekeeper → /bookings/new redirects to /housekeeper')
await expectRedirect(sessions.manager, '/bookings/new', HOME.manager, 'manager → /bookings/new redirects to /manager')

// ── 7. Admin = superuser (admin can hit any staff portal) ──

await expectOk(sessions.admin, '/reception', 'admin → /reception is 200 (superuser)')
await expectOk(sessions.admin, '/housekeeper', 'admin → /housekeeper is 200 (superuser)')
await expectOk(sessions.admin, '/manager', 'admin → /manager is 200 (superuser)')

// ── 8. Admin blocked from /bookings (admin is NOT user) ──

await expectRedirect(sessions.admin, '/bookings', HOME.admin, 'admin → /bookings redirects to /admin')
await expectRedirect(sessions.admin, '/bookings/new', HOME.admin, 'admin → /bookings/new redirects to /admin')

// ── 9. Unauthed user → /bookings → /login (proxy protected paths) ──

await expectRedirect('', '/bookings', '/login', 'unauthed → /bookings redirects to /login')
await expectRedirect('', '/admin', '/login', 'unauthed → /admin redirects to /login')

console.log('\n' + (failed === 0 ? '✅' : '⚠️') + '  ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed === 0 ? 0 : 1)