/**
 * Unit tests for the guest-facing no-show rule.
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNoShow } from './no-show'

test('not a no-show on the check-in day itself', () => {
  assert.equal(isNoShow('confirmed', '2026-10-25', '2026-10-25'), false)
  assert.equal(isNoShow('confirmed', '2026-10-26', '2026-10-25'), false)
})

test('no-show from the day after check-in', () => {
  assert.equal(isNoShow('confirmed', '2026-10-24', '2026-10-25'), true)
  assert.equal(isNoShow('confirmed', '2026-10-31', '2026-11-01'), true) // crosses a month
})

test('only confirmed bookings can be no-shows', () => {
  for (const status of ['checked_in', 'checked_out', 'cancelled', 'expired', 'temp_pending', 'pending']) {
    assert.equal(isNoShow(status, '2026-10-20', '2026-10-25'), false, status)
  }
})
