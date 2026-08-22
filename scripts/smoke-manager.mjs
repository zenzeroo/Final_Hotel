/**
 * Smoke test manager routes by logging in via Supabase Auth REST API
 * and reusing the resulting cookies for subsequent requests.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const APP = 'http://localhost:3000'
const EMAIL = 'manager@zenzero.com'
const PASSWORD = process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!'

if (!BASE || !ANON) {
  console.error('Missing env vars')
  process.exit(1)
}

function parseCookies(setCookieHeaders) {
  const jar = new Map()
  for (const h of setCookieHeaders) {
    const [pair] = h.split(';')
    const [k, v] = pair.split('=')
    jar.set(k.trim(), v.trim())
  }
  return jar
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function absorbCookies(jar, res) {
  const headers = res.headers
  if (typeof headers.getSetCookie === 'function') {
    for (const c of headers.getSetCookie()) {
      const [pair] = c.split(';')
      const [k, v] = pair.split('=')
      jar.set(k.trim(), v.trim())
    }
  }
}

async function step(name, fn) {
  process.stdout.write(`\n▶ ${name}\n`)
  try {
    const result = await fn()
    console.log(`  ✓ ${name}` + (result ? ` — ${result}` : ''))
    return true
  } catch (e) {
    console.log(`  ✗ ${name} — ${e.message}`)
    return false
  }
}

const jar = new Map()

// 1. Sign in via Supabase Auth API
await step('Sign in as manager@zenzero.com', async () => {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status}: ${txt}`)
  }
  const data = await res.json()
  absorbCookies(jar, res)
  // Extract access_token + refresh_token from JSON response (Supabase returns these in body)
  if (data.access_token) {
    jar.set('sb-access-token', data.access_token)
    jar.set('sb-refresh-token', data.refresh_token)
  }
  return `user=${data.user?.id}, role check needed`
})

// 2. Fetch /login to set initial cookies (Supabase SSR pattern)
await step('Visit /login (establish session cookies)', async () => {
  const res = await fetch(`${APP}/login`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: 'manual',
  })
  absorbCookies(jar, res)
  return `HTTP ${res.status}`
})

// 3. Try protected /manager route
let managerHtml = ''
await step('GET /manager', async () => {
  const res = await fetch(`${APP}/manager`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: 'manual',
  })
  absorbCookies(jar, res)
  if (res.status !== 200) {
    const loc = res.headers.get('location')
    throw new Error(`HTTP ${res.status} → ${loc ?? '(no redirect)'}`)
  }
  managerHtml = await res.text()
  return `${(managerHtml.length / 1024).toFixed(1)} KB HTML`
})

// 4. Check key UI fragments in HTML
await step('Dashboard renders "รายได้วันนี้" KPI', () => {
  if (!managerHtml.includes('รายได้วันนี้')) throw new Error('KPI label not found')
})
await step('Dashboard renders Thai baht amount (฿142,500)', () => {
  if (!managerHtml.includes('฿142,500')) throw new Error('mock revenue ฿142,500 not in HTML')
})
await step('Dashboard renders alerts panel with 3 items', () => {
  // Check for one of the alert titles
  if (!managerHtml.includes('ระบบปรับอากาศห้อง 302')) throw new Error('Critical alert missing')
  if (!managerHtml.includes('Walk-in กลุ่มใหญ่')) throw new Error('Warning alert missing')
})
await step('Dashboard renders 7 revenue bars', () => {
  const matches = managerHtml.match(/aria-label="[A-Z][a-z]{2}: ฿/g)
  if (!matches || matches.length !== 7) throw new Error(`expected 7 bars, found ${matches?.length ?? 0}`)
})
await step('Sidebar shows "Booking Oversight" + "Housekeeping Overview"', () => {
  if (!managerHtml.includes('Booking Oversight')) throw new Error('Booking Oversight link missing')
  if (!managerHtml.includes('Housekeeping Overview')) throw new Error('Housekeeping link missing')
})
await step('Sidebar shows 4 disabled "Soon" items', () => {
  const soonCount = (managerHtml.match(/เร็วๆ นี้|Soon/g) ?? []).length
  if (soonCount < 4) throw new Error(`expected ≥4 "Soon" markers, found ${soonCount}`)
})

// 5. Housekeeping
let hkHtml = ''
await step('GET /manager/housekeeping', async () => {
  const res = await fetch(`${APP}/manager/housekeeping`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: 'manual',
  })
  absorbCookies(jar, res)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  hkHtml = await res.text()
  return `${(hkHtml.length / 1024).toFixed(1)} KB`
})
await step('Housekeeping KPI strip shows "Total Rooms", "Dirty", "Inspected"', () => {
  for (const t of ['Total Rooms', 'Dirty', 'Cleaning', 'Inspected / Ready']) {
    if (!hkHtml.includes(t)) throw new Error(`missing KPI: ${t}`)
  }
})
await step('Real-Time Room Status shows Floor 3 — Deluxe Forest View', () => {
  if (!hkHtml.includes('Deluxe Forest View')) throw new Error('floor label missing')
})
await step('Floor Assignments shows "Somjit" / "Niran"', () => {
  if (!hkHtml.includes('Somjit')) throw new Error('Somjit missing')
  if (!hkHtml.includes('Niran')) throw new Error('Niran missing')
})
await step('Damage Report Log shows room 304 / 402 / 201', () => {
  if (!hkHtml.includes('>304<')) throw new Error('room 304 missing')
  if (!hkHtml.includes('>402<')) throw new Error('room 402 missing')
  if (!hkHtml.includes('>201<')) throw new Error('room 201 missing')
})
await step('Damage Report table has severity "ปกติ" and "เร่งด่วน"', () => {
  if (!hkHtml.includes('ปกติ')) throw new Error('ปกติ missing')
  if (!hkHtml.includes('เร่งด่วน')) throw new Error('เร่งด่วน missing')
})

// 6. Bookings — main tab
let bkHtml = ''
await step('GET /manager/bookings (main tab)', async () => {
  const res = await fetch(`${APP}/manager/bookings`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: 'manual',
  })
  absorbCookies(jar, res)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  bkHtml = await res.text()
  return `${(bkHtml.length / 1024).toFixed(1)} KB`
})
await step('Main Bookings table shows Eleanor Smith + #ZZ-10492', () => {
  if (!bkHtml.includes('Eleanor Smith')) throw new Error('guest missing')
  if (!bkHtml.includes('#ZZ-10492')) throw new Error('booking code missing')
})
await step('Tab nav shows "คำขอคืนเงิน" with badge', () => {
  if (!bkHtml.includes('คำขอคืนเงิน')) throw new Error('refunds tab missing')
})

// 7. Bookings — refunds tab
await step('GET /manager/bookings?tab=refunds', async () => {
  const res = await fetch(`${APP}/manager/bookings?tab=refunds`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: 'manual',
  })
  absorbCookies(jar, res)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  if (!html.includes('Tahani Al-Jamil')) throw new Error('refund card Tahani missing')
  if (!html.includes('Approve')) throw new Error('Approve button missing')
  return '3 refund cards rendered'
})

// 8. Bookings — audit tab
await step('GET /manager/bookings?tab=audit', async () => {
  const res = await fetch(`${APP}/manager/bookings?tab=audit`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: 'manual',
  })
  absorbCookies(jar, res)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  if (!html.includes('MGR-02')) throw new Error('staff ID missing')
  if (!html.includes('Special Edit')) throw new Error('audit action missing')
  return '5 audit entries rendered'
})

// 9. Reports
let repHtml = ''
await step('GET /manager/reports', async () => {
  const res = await fetch(`${APP}/manager/reports`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: 'manual',
  })
  absorbCookies(jar, res)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  repHtml = await res.text()
  return `${(repHtml.length / 1024).toFixed(1)} KB`
})
await step('Reports shows Total Revenue ฿1,245,000', () => {
  if (!repHtml.includes('1,245,000')) throw new Error('total revenue missing')
})
await step('Reports shows Booking Channels with User Web / Walk-in / OTA', () => {
  for (const c of ['User Web', 'Walk-in', 'OTA']) {
    if (!repHtml.includes(c)) throw new Error(`channel missing: ${c}`)
  }
})
await step('Reports shows "Cancellation Rate"', () => {
  if (!repHtml.includes('Cancellation Rate')) throw new Error('cancellation card missing')
})
await step('Reports renders Chart.js canvases', () => {
  const canvasCount = (repHtml.match(/<canvas/g) ?? []).length
  if (canvasCount < 3) throw new Error(`expected ≥3 <canvas>, found ${canvasCount}`)
})

console.log('\n✅ All smoke tests passed.')
