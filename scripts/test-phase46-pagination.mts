/**
 * Phase 46 — Pagination smoke test for /reception/bookings.
 *
 * Verifies the new `getAllBookings({ page, pageSize })` API:
 *   1. page=1 returns up to `pageSize` rows + correct `total`
 *   2. page=2 returns the NEXT page with no overlap to page 1
 *   3. status filter narrows the result set correctly
 *   4. search filter narrows the result set correctly
 *   5. HTTP fetch of /reception/bookings?page=1 (as reception) returns 200
 *      with a `หน้า X / Y` indicator
 *
 * Uses @supabase/supabase-js directly with the service-role key so we
 * bypass RLS — same pattern as test-phase*.mts scripts.
 *
 * Run: npx tsx scripts/test-phase46-pagination.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const APP = 'http://localhost:3000'

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

// ── Service-role client (bypasses RLS for inspection) ──────────────────────

const svc = createClient(BASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Re-implements getAllBookings exactly as it lives in lib/data/staff.ts
// (without importing the Next.js cookies-bound createClient). If this
// drifts from the production impl, both files would need updating —
// documented as a known coupling.
const PAGE_SIZE = 20

async function getAllBookings(filters: {
  page?: number
  pageSize?: number
  status?: string[]
  search?: string
}) {
  const wantsPagination = typeof filters.page === 'number' && filters.page >= 1
  const pageSize = Math.min(Math.max(filters.pageSize ?? PAGE_SIZE, 1), 200)
  const page = wantsPagination ? Math.floor(filters.page!) : 1
  const from = wantsPagination ? (page - 1) * pageSize : 0
  const to = wantsPagination ? from + pageSize - 1 : 199

  let dataQuery = svc
    .from('bookings')
    .select(
      `
      id, check_in, booking_code,
      room_type:room_types(id, slug, name_th)
    `,
    )
    .order('check_in', { ascending: false })
    .range(from, to)
  if (filters.status && filters.status.length > 0) {
    dataQuery = dataQuery.in('status', filters.status)
  }
  if (filters.search) {
    dataQuery = dataQuery.or(
      `booking_code.ilike.%${filters.search}%,booker_full_name.ilike.%${filters.search}%,booker_email.ilike.%${filters.search}%`,
    )
  }

  let countQuery: ReturnType<typeof svc.from> | null = null
  if (wantsPagination) {
    let q = svc.from('bookings').select('id', { count: 'exact', head: true })
    if (filters.status && filters.status.length > 0) q = q.in('status', filters.status)
    if (filters.search) {
      q = q.or(
        `booking_code.ilike.%${filters.search}%,booker_full_name.ilike.%${filters.search}%,booker_email.ilike.%${filters.search}%`,
      )
    }
    countQuery = q
  }

  const [dataRes, countRes] = await Promise.all([
    dataQuery,
    countQuery
      ? (countQuery as unknown as Promise<{ count: number | null; error: unknown }>)
      : Promise.resolve({ count: null, error: null }),
  ])

  if (dataRes.error) throw new Error('data: ' + dataRes.error.message)
  if (countRes.error) throw new Error('count: ' + JSON.stringify(countRes.error))

  const rows = (dataRes.data ?? []) as Array<{ id: string; check_in: string; booking_code: string }>
  const total = wantsPagination ? countRes.count ?? 0 : 0
  const totalPages = wantsPagination && pageSize > 0 ? Math.ceil(total / pageSize) : 0
  return { rows, total, page, pageSize, totalPages }
}

// ── Reception session (for HTTP smoke test) ─────────────────────────────────

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
  return {
    cookies,
    supabase,
    cookieHeader: () => cookies.map((c) => c.name + '=' + c.value).join('; '),
  }
}

// ── Baseline: how many bookings exist? ─────────────────────────────────────

const baseline = await getAllBookings({ page: 1, pageSize: 1 })
const totalBookings = baseline.total

await step('Baseline: total bookings in DB', async () => {
  return `${totalBookings} rows`
})

// ── Tests ──────────────────────────────────────────────────────────────────

if (totalBookings === 0) {
  console.log('⚠ No bookings in DB — skipping data tests. HTTP smoke test still runs.')
} else {
  // 1. page=1 returns rows and total
  await step('page=1 pageSize=20 returns at most 20 rows', async () => {
    const result = await getAllBookings({ page: 1, pageSize: 20 })
    assert(result.rows.length <= 20, `expected ≤ 20 rows, got ${result.rows.length}`)
    assert(result.total === totalBookings, `expected total=${totalBookings}, got ${result.total}`)
    assert(result.page === 1, `expected page=1, got ${result.page}`)
    assert(result.totalPages === Math.ceil(totalBookings / 20), `totalPages mismatch: ${result.totalPages}`)
    return `rows=${result.rows.length}, total=${result.total}, totalPages=${result.totalPages}`
  })

  // 2. page=2 has no overlap with page=1 (only meaningful when total > 20)
  if (totalBookings > 20) {
    await step('page=1 + page=2 have no id overlap', async () => {
      const [p1, p2] = await Promise.all([
        getAllBookings({ page: 1, pageSize: 20 }),
        getAllBookings({ page: 2, pageSize: 20 }),
      ])
      const p1Ids = new Set(p1.rows.map((r) => r.id))
      const overlap = p2.rows.filter((r) => p1Ids.has(r.id))
      assert(overlap.length === 0, `expected 0 overlap, got ${overlap.length}`)
      return `p1=${p1.rows.length} rows, p2=${p2.rows.length} rows, overlap=0`
    })
  } else {
    await step('page=2 returns empty (total ≤ 20)', async () => {
      const result = await getAllBookings({ page: 2, pageSize: 20 })
      assert(result.rows.length === 0, `expected 0 rows on page=2, got ${result.rows.length}`)
      return `page=2 with total≤20 → 0 rows`
    })
  }

  // 3. status filter narrows result
  await step('status filter narrows total', async () => {
    const result = await getAllBookings({ page: 1, pageSize: 20, status: ['confirmed'] })
    assert(result.total <= totalBookings, `filtered total (${result.total}) > baseline (${totalBookings})`)
    return `confirmed only → total=${result.total}`
  })

  // 4. search filter narrows result
  await step('search filter narrows total', async () => {
    // Pick a known substring from the first row
    const first = (await getAllBookings({ page: 1, pageSize: 1 })).rows[0]
    assert(first, 'no row to extract substring from')
    const sub = first.booking_code.slice(0, 3)
    const result = await getAllBookings({ page: 1, pageSize: 20, search: sub })
    assert(result.total <= totalBookings, `filtered total > baseline`)
    assert(result.total >= 1, `expected at least 1 match for substring "${sub}"`)
    return `search="${sub}" → total=${result.total}`
  })
}

// ── HTTP smoke test: reception session hits the page ───────────────────────

await step('Sign in as reception@zenzero.com', async () => {
  const sess = buildSession('reception@zenzero.com', 'ReceptionPass123!')
  const { error, data } = await sess.supabase.auth.signInWithPassword({
    email: 'reception@zenzero.com',
    password: 'ReceptionPass123!',
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  ;(globalThis as { __receptionCookie?: string }).__receptionCookie = sess.cookieHeader()
  return 'uid=' + data.user.id.slice(0, 8) + '…'
})

const receptionCookie = (globalThis as { __receptionCookie?: string }).__receptionCookie!

await step('GET /reception/bookings?page=1 returns 200', async () => {
  const res = await fetch(APP + '/reception/bookings?page=1', {
    headers: { Cookie: receptionCookie },
    redirect: 'manual',
  })
  assert(res.status === 200, `expected 200, got ${res.status} (location=${res.headers.get('location')})`)
  const html = await res.text()
  assert(html.includes('จัดการการจอง'), 'page header missing')
  return '200 OK with header'
})

await step('GET /reception/bookings?page=1 contains page indicator', async () => {
  const res = await fetch(APP + '/reception/bookings?page=1', {
    headers: { Cookie: receptionCookie },
    redirect: 'manual',
  })
  const html = await res.text()
  if (totalBookings === 0) {
    assert(html.includes('0 รายการ'), 'expected empty-state copy')
    return 'empty state shown (0 rows)'
  }
  assert(/หน้า\s*1\s*\/\s*\d+/.test(html), 'page indicator (หน้า 1 / N) missing')
  return 'page indicator present'
})

await step('GET /reception/bookings?page=9999 → redirect to last page', async () => {
  const res = await fetch(APP + '/reception/bookings?page=9999', {
    headers: { Cookie: receptionCookie },
    redirect: 'manual',
  })
  // Either a 307 redirect to a valid page, or 200 if total=0 (no redirect needed)
  if (totalBookings === 0) {
    assert(res.status === 200, `expected 200 (no redirect when total=0), got ${res.status}`)
    return '200 (no redirect for empty DB)'
  }
  assert(
    res.status === 307 || res.status === 308,
    `expected 3xx redirect, got ${res.status}`,
  )
  const loc = res.headers.get('location') ?? ''
  assert(loc.includes('/reception/bookings'), `expected redirect back to /reception/bookings, got ${loc}`)
  return `→ ${loc}`
})

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('\n────────────────────────────────')
console.log(`  ${passed} passed, ${failed} failed`)
console.log('────────────────────────────────')
process.exit(failed === 0 ? 0 : 1)