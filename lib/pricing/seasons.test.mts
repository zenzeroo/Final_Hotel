/**
 * Unit tests for the pricing engine — Phase 8.
 * Run with:  npx tsx --test lib/pricing/seasons.test.mts
 *   (Node 24 also supports:  node --test lib/pricing/seasons.test.mts)
 *
 * Asserts ≥ 12 cases per the spec.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickSeasonalRate,
  quoteStay,
  violatesMinNights,
  type QuoteInput,
  type QuoteResult,
} from './seasons'
import type { SeasonalRate } from '@/lib/data/types'

// Test helpers — fixed UUIDs so id-desc sort is deterministic.
const RATE_A = '00000000-0000-0000-0000-00000000000a'
const RATE_B = '00000000-0000-0000-0000-00000000000b'
const RATE_C = '00000000-0000-0000-0000-00000000000c'

function makeRate(overrides: Partial<SeasonalRate>): SeasonalRate {
  return {
    id: RATE_A,
    room_type_id: 'rt-1',
    label: 'Default Rate',
    start_date: '2026-12-01',
    end_date: '2026-12-31',
    flat_price: 1000,
    price_multiplier: null,
    min_nights_override: null,
    is_active: true,
    priority: 0,
    ...overrides,
  }
}

const BASE_PRICE = 5000
const ROOM_TYPE_ID = 'rt-1'

function quote(overrides: Partial<QuoteInput> = {}): QuoteResult {
  return quoteStay({
    roomTypeId: ROOM_TYPE_ID,
    basePrice: BASE_PRICE,
    checkIn: '2026-12-01',
    checkOut: '2026-12-04',
    rates: [],
    ...overrides,
  })
}

test('1. No rates → all nights at base_price, no applied rates', () => {
  const q = quote()
  assert.equal(q.nights, 3)
  assert.equal(q.baseSubtotal, BASE_PRICE * 3)
  assert.equal(q.appliedRates.length, 0)
  assert.equal(q.nightlyBreakdown.every((b) => b.rate === BASE_PRICE && b.rateId === null), true)
})

test('2. Single rate covers entire stay with flat_price', () => {
  const rate = makeRate({ flat_price: 12500, price_multiplier: null, start_date: '2026-12-01', end_date: '2026-12-31' })
  const q = quote({ rates: [rate] })
  assert.equal(q.baseSubtotal, 12500 * 3)
  assert.equal(q.appliedRates.length, 1)
  assert.equal(q.appliedRates[0].nights, 3)
  assert.equal(q.nightlyBreakdown.every((b) => b.rateLabel === 'Default Rate'), true)
})

test('3. Single rate with price_multiplier (rounded)', () => {
  const rate = makeRate({ flat_price: null, price_multiplier: 1.5 })
  const q = quote({ rates: [rate] })
  assert.equal(q.baseSubtotal, Math.round(BASE_PRICE * 1.5) * 3)
  assert.equal(q.nightlyBreakdown.every((b) => b.rateId === RATE_A), true)
})

test('4. Two non-overlapping rates — split stay', () => {
  const a = makeRate({ id: RATE_A, flat_price: 8000, start_date: '2026-12-01', end_date: '2026-12-02', label: 'Early' })
  const b = makeRate({ id: RATE_B, flat_price: 12000, start_date: '2026-12-03', end_date: '2026-12-04', label: 'Late' })
  const q = quote({ checkIn: '2026-12-01', checkOut: '2026-12-05', rates: [a, b] })
  assert.equal(q.nights, 4)
  assert.equal(q.baseSubtotal, 8000 * 2 + 12000 * 2)
  assert.equal(q.appliedRates.length, 2)
  assert.deepEqual(
    q.nightlyBreakdown.map((b) => ({ date: b.date, rate: b.rate })),
    [
      { date: '2026-12-01', rate: 8000 },
      { date: '2026-12-02', rate: 8000 },
      { date: '2026-12-03', rate: 12000 },
      { date: '2026-12-04', rate: 12000 },
    ],
  )
})

test('5. Overlapping rates — higher priority wins', () => {
  const low = makeRate({ id: RATE_A, flat_price: 6000, priority: 1, label: 'Low' })
  const high = makeRate({ id: RATE_B, flat_price: 9000, priority: 5, label: 'High' })
  const q = quote({ rates: [low, high] })
  assert.equal(q.baseSubtotal, 9000 * 3)
  assert.equal(q.appliedRates.length, 1)
  assert.equal(q.appliedRates[0].label, 'High')
})

test('6. Same priority — id DESC wins (deterministic)', () => {
  const a = makeRate({ id: RATE_A, flat_price: 7000, priority: 5, label: 'A' })
  const b = makeRate({ id: RATE_B, flat_price: 9000, priority: 5, label: 'B' })
  // Both priority=5; B has larger id → wins.
  const q = quote({ rates: [a, b] })
  assert.equal(q.baseSubtotal, 9000 * 3)
  assert.equal(q.appliedRates[0].label, 'B')
})

test('7. Rate that starts mid-stay — only covered nights use it', () => {
  const a = makeRate({ flat_price: 12000, start_date: '2026-12-02', end_date: '2026-12-03', label: 'Mid' })
  const q = quote({ checkIn: '2026-12-01', checkOut: '2026-12-04', rates: [a] })
  // Nights: Dec 1 (base), Dec 2 (12000), Dec 3 (12000) — but Dec 3 is end_date inclusive, so it counts.
  assert.equal(q.baseSubtotal, BASE_PRICE + 12000 + 12000)
  assert.equal(q.appliedRates[0].nights, 2)
})

test('8. violatesMinNights → true when applied rate has override > nights', () => {
  const rate = makeRate({ min_nights_override: 5 })
  const q = quote({ rates: [rate] })
  assert.equal(violatesMinNights(q, [rate]), true)
})

test('9. violatesMinNights → false when overrides are null', () => {
  const rate = makeRate({ min_nights_override: null })
  const q = quote({ rates: [rate] })
  assert.equal(violatesMinNights(q, [rate]), false)
})

test('10. pickSeasonalRate with empty array returns null', () => {
  assert.equal(pickSeasonalRate([], '2026-12-15'), null)
})

test('11. quoteStay throws when checkIn >= checkOut', () => {
  assert.throws(() => quote({ checkIn: '2026-12-04', checkOut: '2026-12-04' }))
  assert.throws(() => quote({ checkIn: '2026-12-05', checkOut: '2026-12-04' }))
})

test('12. Rate that does not overlap → falls back to base_price', () => {
  const rate = makeRate({ flat_price: 99999, start_date: '2027-01-01', end_date: '2027-01-31' })
  const q = quote({ rates: [rate] })
  assert.equal(q.baseSubtotal, BASE_PRICE * 3)
  assert.equal(q.appliedRates.length, 0)
})

// Extra coverage beyond the spec's 12 (bonus).

test('13. Inactive rate is ignored', () => {
  const rate = makeRate({ flat_price: 99999, is_active: false })
  const q = quote({ rates: [rate] })
  assert.equal(q.baseSubtotal, BASE_PRICE * 3)
  assert.equal(q.appliedRates.length, 0)
})

test('14. Multiple applied rates are sorted by nights desc', () => {
  const a = makeRate({ id: RATE_A, flat_price: 6000, start_date: '2026-12-01', end_date: '2026-12-03', label: 'Big' })
  const b = makeRate({ id: RATE_B, flat_price: 6000, start_date: '2026-12-04', end_date: '2026-12-04', label: 'Small' })
  const q = quote({ checkIn: '2026-12-01', checkOut: '2026-12-05', rates: [a, b] })
  assert.equal(q.appliedRates[0].label, 'Big')
  assert.equal(q.appliedRates[0].nights, 3)
  assert.equal(q.appliedRates[1].label, 'Small')
  assert.equal(q.appliedRates[1].nights, 1)
})

test('15. violatesMinNights requires applied rate to exist', () => {
  // override=5 > 3 nights → if applied, it would be violated.
  const rate = makeRate({ min_nights_override: 5 })
  // Case A: quote built with NO rates → no applied rates → not violated (even though override is in `rates` arg).
  const qEmpty = quote({ rates: [] })
  assert.equal(violatesMinNights(qEmpty, [rate]), false)
  // Case B: quote built WITH the rate applied → override > nights → violated.
  const qApplied = quote({ rates: [rate] })
  assert.equal(violatesMinNights(qApplied, [rate]), true)
})
