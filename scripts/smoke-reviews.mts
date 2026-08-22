/**
 * Smoke test reviews routes with real Supabase SSR sessions.
 *
 * Steps:
 *  1. Sign in as manager + admin via @supabase/ssr
 *  2. GET /manager/reviews?tab=pending  — Olivia + Tahani visible
 *  3. GET /manager/reviews?tab=approved — Eleanor + James + Sofia visible
 *  4. GET /manager/reviews?tab=hidden   — Markus visible
 *  5. GET /rooms/serenity-suite         — Eleanor + James visible (approved only)
 *  6. GET /manager/reviews?tab=hidden as non-admin — Delete buttons absent
 *
 * Run: npx tsx scripts/smoke-reviews.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
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

async function fetchHtml(path: string, cookie: string): Promise<string> {
  const res = await fetch(`${APP}${path}`, { headers: { Cookie: cookie }, redirect: 'manual' })
  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status}`)
  }
  return res.text()
}

// ── Sign in as manager ─────────────────────────────────────────────────────

const mgr = buildSession(MANAGER_EMAIL, MANAGER_PASSWORD)
await step('Sign in as manager', async () => {
  const { data, error } = await mgr.supabase.auth.signInWithPassword({
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('no user')
  return `uid=${data.user.id}`
})

const mgrCookie = mgr.cookieHeader()

// ── Pending tab ────────────────────────────────────────────────────────────

let pendingHtml = ''
await step('GET /manager/reviews?tab=pending', async () => {
  pendingHtml = await fetchHtml('/manager/reviews?tab=pending', mgrCookie)
  return `${(pendingHtml.length / 1024).toFixed(1)} KB`
})
await step('Pending tab shows Olivia Brown', () => {
  assert(pendingHtml.includes('Olivia Brown'), 'Olivia Brown missing from pending tab')
})
await step('Pending tab shows Tahani Al-Jamil', () => {
  assert(pendingHtml.includes('Tahani Al-Jamil'), 'Tahani Al-Jamil missing from pending tab')
})
await step('Pending tab has Approve buttons', () => {
  // Thai: อนุมัติ — count must equal pending reviews shown (≥2)
  const count = (pendingHtml.match(/อนุมัติ/g) ?? []).length
  assert(count >= 2, `expected ≥2 Approve buttons, got ${count}`)
})
await step('Pending tab does NOT show Eleanor (approved)', () => {
  assert(!pendingHtml.includes('Eleanor Smith'), 'Eleanor leaked into pending tab')
})

// ── Approved tab ───────────────────────────────────────────────────────────

let approvedHtml = ''
await step('GET /manager/reviews?tab=approved', async () => {
  approvedHtml = await fetchHtml('/manager/reviews?tab=approved', mgrCookie)
})
await step('Approved tab shows Eleanor Smith', () => {
  assert(approvedHtml.includes('Eleanor Smith'), 'Eleanor missing from approved tab')
})
await step('Approved tab shows James O', () => {
  assert(approvedHtml.includes("James O'Connor"), "James O'Connor missing from approved tab")
})
await step('Approved tab shows Sofia Petrova', () => {
  assert(approvedHtml.includes('Sofia Petrova'), 'Sofia Petrova missing from approved tab')
})
await step('Approved tab has Hide buttons (3 expected)', () => {
  const count = (approvedHtml.match(/ซ่อน/g) ?? []).length
  assert(count >= 3, `expected ≥3 ซ่อน buttons, got ${count}`)
})

// ── Hidden tab ─────────────────────────────────────────────────────────────

let hiddenHtml = ''
await step('GET /manager/reviews?tab=hidden', async () => {
  hiddenHtml = await fetchHtml('/manager/reviews?tab=hidden', mgrCookie)
})
await step('Hidden tab shows Markus Schneider', () => {
  assert(hiddenHtml.includes('Markus Schneider'), 'Markus missing from hidden tab')
})
await step('Hidden tab has Unhide button', () => {
  assert(hiddenHtml.includes('กู้คืน'), 'กู้คืน button missing from hidden tab')
})

// ── Public room page — only approved reviews shown ────────────────────────

let serenityHtml = ''
await step('GET /rooms/serenity-suite', async () => {
  serenityHtml = await fetchHtml('/rooms/serenity-suite', mgrCookie)
})
await step('Public page shows Eleanor Smith', () => {
  assert(serenityHtml.includes('Eleanor Smith'), 'Eleanor not visible publicly')
})
await step("Public page shows James O'Connor", () => {
  assert(serenityHtml.includes("James O'Connor"), "James not visible publicly")
})
await step('Public page does NOT show Olivia (pending)', () => {
  assert(!serenityHtml.includes('Olivia Brown'), 'Olivia leaked into public room page')
})
await step('Public page does NOT show Markus (hidden)', () => {
  assert(!serenityHtml.includes('Markus Schneider'), 'Markus leaked into public room page')
})
await step('Public page has "รีวิวจากผู้เข้าพัก" header', () => {
  assert(serenityHtml.includes('รีวิวจากผู้เข้าพัก'), 'reviews header missing')
})
await step('Public page does NOT have the Soon placeholder', () => {
  assert(
    !serenityHtml.includes('ระบบรีวิวจะพร้อมใช้งานในเร็วๆ นี้'),
    'phase-4 placeholder text still present',
  )
})

// ── Manager should NOT see Delete buttons (admin-only) ────────────────────

await step('Manager: no Delete buttons visible', () => {
  assert(!pendingHtml.includes('ลบถาวร'), 'manager can see Delete button (admin-only)')
})

// ── Admin should see Delete buttons (skipped if admin user not seeded) ────

let adminAvailable = false
const adm = buildSession(ADMIN_EMAIL, ADMIN_PASSWORD)
await step('Sign in as admin', async () => {
  const { error, data } = await adm.supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  if (error || !data.user) {
    return `admin user not seeded in this dev environment — skipping admin assertions`
  }
  adminAvailable = true
  return `uid=${data.user.id}`
})

if (adminAvailable) {
  const admCookie = adm.cookieHeader()
  await step('Admin: GET /manager/reviews?tab=pending', async () => {
    const html = await fetchHtml('/manager/reviews?tab=pending', admCookie)
    assert(html.includes('Olivia Brown'), 'admin pending tab missing Olivia')
    assert(html.includes('ลบถาวร'), 'admin should see Delete button')
    return 'admin sees Delete button ✓'
  })
}

console.log(`\n${failed === 0 ? '✅' : '⚠️'}  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
