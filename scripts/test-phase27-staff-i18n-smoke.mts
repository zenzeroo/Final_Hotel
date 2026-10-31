/**
 * Phase 27.E — staff portal i18n smoke test (needs `npm run dev` on :3000).
 *
 * Signs in each staff role, fetches every static staff route with the
 * NEXT_LOCALE cookie set to `en` and then `th`, and checks:
 *   1. HTTP 200 (no redirect / crash).
 *   2. No raw dictionary keys leak into the HTML (a missing key renders the
 *      key itself, e.g. "manager.ratesPage.heading").
 *   3. The <html lang> attribute matches the requested locale.
 * It also prints how many Thai-script runs remain in the EN HTML — those
 * should be DB data (room names, guest names), not UI chrome.
 *
 * Run: npx tsx scripts/test-phase27-staff-i18n-smoke.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const APP = process.env.APP_URL ?? 'http://localhost:3000'

const ROLES = {
  admin: { email: 'admin@zenzero.com', password: process.env.ADMIN_TEST_PASSWORD ?? 'AdminPass123!' },
  manager: { email: 'manager@zenzero.com', password: process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!' },
  reception: { email: 'reception@zenzero.com', password: process.env.RECEPTION_TEST_PASSWORD ?? 'ReceptionPass123!' },
  housekeeper: { email: 'somjit@zenzero.com', password: process.env.HOUSEKEEPER_TEST_PASSWORD ?? 'Housekeep123!' },
} as const
type Role = keyof typeof ROLES

const ROUTES: Record<Role, string[]> = {
  admin: ['/admin', '/admin/customers', '/admin/promotions', '/admin/promotions/new', '/admin/promotions/new?tab=dates', '/admin/rates/room-types', '/admin/rates/room-types?tab=deleted', '/admin/rates/room-types/new', '/admin/settings', '/admin/staff', '/admin/hero-carousel', '/admin/profile'],
  manager: ['/manager', '/manager/bookings', '/manager/bookings?tab=refunds', '/manager/bookings?tab=audit', '/manager/housekeeping', '/manager/maintenance', '/manager/promotions', '/manager/rooms', '/manager/reports', '/manager/reviews', '/manager/reviews?tab=hidden', '/manager/settings', '/manager/staff', '/manager/profile'],
  reception: ['/reception', '/reception/bookings', '/reception/bookings/new', '/reception/check-in-out', '/reception/check-in-out?view=upcoming', '/reception/check-in-out?view=inhouse', '/reception/customers', '/reception/customers?q=a', '/reception/history', '/reception/maintenance', '/reception/requests', '/reception/rooms', '/reception/profile'],
  housekeeper: ['/housekeeper', '/housekeeper/tasks', '/housekeeper/tasks?tab=unassigned', '/housekeeper/history', '/housekeeper/maintenance', '/housekeeper/rooms', '/housekeeper/profile'],
}

// Namespaces whose keys would show up verbatim if missing.
const RAW_KEY = /\b(?:staff|manager|reception|housekeeper|admin|actions|validation|email|ui)\.[a-zA-Z]+\.[a-zA-Z.]+\b/g
const THAI_RUN = /[฀-๿]+/g

async function signIn(email: string, password: string): Promise<string> {
  const jar: { name: string; value: string }[] = []
  const supabase = createServerClient(BASE, ANON, {
    cookies: {
      getAll: () => jar,
      setAll: (toSet) => {
        for (const { name, value } of toSet) {
          const i = jar.findIndex((c) => c.name === name)
          if (i >= 0) jar[i] = { name, value }
          else jar.push({ name, value })
        }
      },
    },
  })
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${email}: ${error.message}`)
  return jar.map((c) => `${c.name}=${c.value}`).join('; ')
}

/** Strip <script>/<style> + RSC payload so we only look at rendered markup. */
function visibleHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
}

let failed = 0
let passed = 0
for (const role of Object.keys(ROLES) as Role[]) {
  const cookie = await signIn(ROLES[role].email, ROLES[role].password)
  console.log(`\n${role}`)
  for (const path of ROUTES[role]) {
    for (const locale of ['en', 'th'] as const) {
      const res = await fetch(APP + path, { headers: { Cookie: `${cookie}; NEXT_LOCALE=${locale}` }, redirect: 'manual' })
      const html = visibleHtml(await res.text())
      const problems: string[] = []
      if (res.status !== 200) problems.push(`HTTP ${res.status}${res.headers.get('location') ? ' → ' + res.headers.get('location') : ''}`)
      const keys = [...new Set(html.match(RAW_KEY) ?? [])].filter((k) => !/\.(?:png|jpe?g|webp|svg|css|js)$/.test(k))
      if (keys.length) problems.push(`raw keys: ${keys.slice(0, 5).join(', ')}`)
      if (!new RegExp(`<html[^>]*lang="${locale}"`).test(html)) problems.push('html lang mismatch')
      const thai = locale === 'en' ? [...new Set(html.match(THAI_RUN) ?? [])] : []
      const label = `${locale} ${path}`
      if (problems.length) {
        failed++
        console.log(`  ✗ ${label} — ${problems.join(' | ')}`)
      } else {
        passed++
        console.log(`  ✓ ${label}${thai.length ? `  (Thai runs in EN: ${thai.length} — e.g. ${thai.slice(0, 3).join(' / ')})` : ''}`)
      }
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
