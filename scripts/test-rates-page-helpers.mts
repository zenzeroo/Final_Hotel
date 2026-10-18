/**
 * Pure helpers behind /manager/rates — status buckets, multiplier text,
 * rate state badges, today's price. No DB.
 *
 *   npx tsx scripts/test-rates-page-helpers.mts
 */
import { roomBucket, isClosedStatus } from '../components/manager/roomStatusBuckets'
import { formatMultiplier, rateState, todayPrice } from '../components/manager/ratePrice'
import type { RoomUnitStatus, SeasonalRate } from '../lib/data/types'

let passed = 0
let failed = 0
function check(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`)
  }
}
function eq<T>(actual: T, expected: T) {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`)
}

const ALL: RoomUnitStatus[] = [
  'available', 'occupied', 'cleaning', 'maintenance', 'out_of_order',
  'waiting_cleaning', 'inspection', 'ready', 'checkout',
]

check('every status maps to a bucket', () => {
  for (const s of ALL) {
    const b = roomBucket(s)
    if (!['available', 'occupied', 'cleaning', 'closed'].includes(b)) throw new Error(`${s} → ${b}`)
  }
})
check('ready counts as available', () => eq(roomBucket('ready'), 'available'))
check('waiting_cleaning / inspection / checkout count as cleaning', () => {
  eq(roomBucket('waiting_cleaning'), 'cleaning')
  eq(roomBucket('inspection'), 'cleaning')
  eq(roomBucket('checkout'), 'cleaning')
})
check('maintenance / out_of_order are closed', () => {
  eq(roomBucket('maintenance'), 'closed')
  eq(roomBucket('out_of_order'), 'closed')
  eq(isClosedStatus('maintenance'), true)
  eq(isClosedStatus('ready'), false)
})

check('formatMultiplier 1.5 → +50%', () => eq(formatMultiplier(1.5), '+50%'))
check('formatMultiplier 0.8 → −20%', () => eq(formatMultiplier(0.8), '−20%'))
check('formatMultiplier 1 → ±0%', () => eq(formatMultiplier(1), '±0%'))

const rate = (over: Partial<SeasonalRate>): SeasonalRate => ({
  id: 'r1', room_type_id: 'rt1', label: 'High', start_date: '2026-10-01', end_date: '2026-10-31',
  flat_price: null, price_multiplier: null, min_nights_override: null, is_active: true, priority: 0,
  ...over,
})

check('rateState: inactive / expired / current / upcoming', () => {
  eq(rateState(rate({ is_active: false }), '2026-10-17'), 'inactive')
  eq(rateState(rate({}), '2026-11-01'), 'expired')
  eq(rateState(rate({}), '2026-10-31'), 'current')
  eq(rateState(rate({}), '2026-09-30'), 'upcoming')
})

check('todayPrice: no rate → base', () => {
  eq(todayPrice(1000, [], 'rt1', '2026-10-17').price, 1000)
})
check('todayPrice: flat rate wins', () => {
  const r = todayPrice(1000, [rate({ flat_price: 1800 })], 'rt1', '2026-10-17')
  eq(r.price, 1800)
  eq(r.label, 'High')
})
check('todayPrice: multiplier rounded', () => {
  eq(todayPrice(1001, [rate({ price_multiplier: 1.5 })], 'rt1', '2026-10-17').price, 1502)
})
check('todayPrice: other room type ignored', () => {
  eq(todayPrice(1000, [rate({ room_type_id: 'rt2', flat_price: 1800 })], 'rt1', '2026-10-17').price, 1000)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
