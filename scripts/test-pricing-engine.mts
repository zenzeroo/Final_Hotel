/**
 * Smoke test for Phase 8 — Pricing Engine Integration.
 *
 * Strategy:
 *  - Cases 1–5 exercise the integration end-to-end via the mock data layer
 *    (no HTTP — purely the dispatcher + pure pricing functions, which is what
 *    the booking action calls into).
 *  - Case 6 hits the `getSeasonalRatesAction` server action via HTTP to verify
 *    it returns 200 + a valid quote when the dev server is running.
 *
 * Prereqs (only for case 6):
 *  - `npm run dev` running on http://localhost:3000
 *  - `.env.local` has USE_MOCK_DATA=1
 *
 * Run: npx tsx scripts/test-pricing-engine.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

// Force the dispatcher onto the mock layer for these tests.
process.env.USE_MOCK_DATA = '1'

import {
  getActiveSeasonalRatesForRange,
  createSeasonalRate,
} from '../lib/data/manager'
import { quoteStay, violatesMinNights } from '../lib/pricing/seasons'
import { calculatePrice } from '../lib/pricing'

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

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg} — expected ${expected}, got ${actual}`)
  }
}

// A throwaway room-type id for these tests.
const ROOM_TYPE = '00000000-0000-0000-0000-00000000p001'
const BASE_PRICE = 5000

const RUN_TAG = Date.now()

await step('1. No rates → legacy nights×base subtotal', async () => {
  const rates = await getActiveSeasonalRatesForRange({
    roomTypeId: ROOM_TYPE,
    checkIn: '2027-03-10',
    checkOut: '2027-03-13',
  })
  const q = quoteStay({
    roomTypeId: ROOM_TYPE,
    basePrice: BASE_PRICE,
    checkIn: '2027-03-10',
    checkOut: '2027-03-13',
    rates,
  })
  assertEqual(q.nights, 3, 'nights')
  assertEqual(q.baseSubtotal, BASE_PRICE * 3, 'baseSubtotal')
  assertEqual(q.appliedRates.length, 0, 'applied rates')
  return 'nights=3, baseSubtotal=' + q.baseSubtotal
})

await step('2. Flat-price rate → quote uses rate per night', async () => {
  await createSeasonalRate({
    room_type_id: ROOM_TYPE,
    label: 'phase8-test-flat-' + RUN_TAG,
    start_date: '2027-04-10',
    end_date: '2027-04-15',
    flat_price: 8000,
    price_multiplier: null,
    min_nights_override: null,
    is_active: true,
    priority: 0,
  })

  const rates = await getActiveSeasonalRatesForRange({
    roomTypeId: ROOM_TYPE,
    checkIn: '2027-04-10',
    checkOut: '2027-04-13',
  })
  const q = quoteStay({
    roomTypeId: ROOM_TYPE,
    basePrice: BASE_PRICE,
    checkIn: '2027-04-10',
    checkOut: '2027-04-13',
    rates,
  })
  assertEqual(q.nights, 3, 'nights')
  assertEqual(q.baseSubtotal, 8000 * 3, 'baseSubtotal')
  assertEqual(q.appliedRates.length, 1, 'applied count')
  assertEqual(q.appliedRates[0].flatPrice ?? null, 8000, 'applied flatPrice')
  return 'baseSubtotal=' + q.baseSubtotal
})

await step('3. Multiplier rate → quote scales base price', async () => {
  await createSeasonalRate({
    room_type_id: ROOM_TYPE,
    label: 'phase8-test-mult-' + RUN_TAG,
    start_date: '2027-05-10',
    end_date: '2027-05-15',
    flat_price: null,
    price_multiplier: 1.4,
    min_nights_override: null,
    is_active: true,
    priority: 0,
  })

  const rates = await getActiveSeasonalRatesForRange({
    roomTypeId: ROOM_TYPE,
    checkIn: '2027-05-10',
    checkOut: '2027-05-13',
  })
  const q = quoteStay({
    roomTypeId: ROOM_TYPE,
    basePrice: BASE_PRICE,
    checkIn: '2027-05-10',
    checkOut: '2027-05-13',
    rates,
  })
  const expectedPerNight = Math.round(BASE_PRICE * 1.4)
  assertEqual(q.baseSubtotal, expectedPerNight * 3, 'baseSubtotal')
  return 'per-night=' + expectedPerNight + ', total=' + q.baseSubtotal
})

await step('4. min_nights_override > stay length → booking blocked', async () => {
  await createSeasonalRate({
    room_type_id: ROOM_TYPE,
    label: 'phase8-test-minN-' + RUN_TAG,
    start_date: '2027-06-10',
    end_date: '2027-06-20',
    flat_price: 9999,
    price_multiplier: null,
    min_nights_override: 7,
    is_active: true,
    priority: 0,
  })

  const rates = await getActiveSeasonalRatesForRange({
    roomTypeId: ROOM_TYPE,
    checkIn: '2027-06-10',
    checkOut: '2027-06-13', // 3 nights, < 7 required
  })
  const q = quoteStay({
    roomTypeId: ROOM_TYPE,
    basePrice: BASE_PRICE,
    checkIn: '2027-06-10',
    checkOut: '2027-06-13',
    rates,
  })
  assert(violatesMinNights(q, rates), 'should violate (3 nights < 7)')
  return 'violatesMinNights=true'
})

await step('5. calculatePrice uses quote.baseSubtotal (not nights×base)', async () => {
  // Re-use the flat-price rate from case 2 (3 nights × 8000 = 24000)
  const rates = await getActiveSeasonalRatesForRange({
    roomTypeId: ROOM_TYPE,
    checkIn: '2027-04-10',
    checkOut: '2027-04-13',
  })
  const q = quoteStay({
    roomTypeId: ROOM_TYPE,
    basePrice: BASE_PRICE,
    checkIn: '2027-04-10',
    checkOut: '2027-04-13',
    rates,
  })
  const price = calculatePrice({
    basePrice: BASE_PRICE,
    checkIn: '2027-04-10',
    checkOut: '2027-04-13',
    quote: q,
  })
  assertEqual(price.baseSubtotal, 24000, 'baseSubtotal from quote')
  assertEqual(price.nights, 3, 'nights from quote')
  // Fee still scales by nights
  assertEqual(price.feeTotal, 3 * 150, 'fee')
  return 'baseSubtotal=' + price.baseSubtotal + ', total=' + price.total
})

// ── HTTP: hit the live getSeasonalRatesAction via action manifest ────────────

await step('6. HTTP — getSeasonalRatesAction returns ok + valid quote', async () => {
  const manifestPath = resolve(
    __dirname,
    '..',
    '.next',
    'dev',
    'server',
    'app',
    'actions',
    'seasonal-rates',
    'server-reference-manifest.json',
  )
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Action manifest not found at ${manifestPath}. Run \`npm run dev\` first.`,
    )
  }
  const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    node?: Record<string, { exportedName?: string }>
  }
  const id = Object.entries(m.node ?? {}).find(
    ([, v]) => v.exportedName === 'getSeasonalRatesAction',
  )?.[0]
  if (!id) throw new Error('getSeasonalRatesAction id not found in manifest')

  const boundary = '----Phase8ActionTest' + Date.now()
  const payload = JSON.stringify({
    roomTypeId: ROOM_TYPE,
    checkIn: '2027-04-10',
    checkOut: '2027-04-13',
    basePrice: BASE_PRICE,
  })
  const parts: Buffer[] = []
  parts.push(Buffer.from(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="$ACTION_ID_' + id + '"\r\n\r\n\r\n',
  ))
  parts.push(Buffer.from('--' + boundary + '\r\n'))
  parts.push(Buffer.from('Content-Type: application/json\r\n\r\n'))
  parts.push(Buffer.from(payload))
  parts.push(Buffer.from('\r\n--' + boundary + '--\r\n'))
  const body = Buffer.concat(parts)

  const res = await fetch('http://localhost:3000/', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
    },
    body,
    redirect: 'manual',
  })
  const text = await res.text()
  assert(res.status >= 200 && res.status < 300, 'HTTP ' + res.status)
  // Server actions return JSON with ok:true on success
  assert(text.includes('"ok":true') || text.includes('"ok": true'), 'ok:true in response')
  return 'status=' + res.status + ', len=' + text.length + 'B'
})

console.log('')
console.log(`Summary: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)