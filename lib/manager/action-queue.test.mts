/**
 * Unit tests for the manager dashboard's "needs action" order.
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actionKinds, seeAllShown } from './action-queue'
import type { DashboardAlert } from '../data/types'

const alert = (kind: DashboardAlert['kind'], severity: DashboardAlert['severity'], count = 1): DashboardAlert => ({
  id: kind,
  kind,
  severity,
  count,
  href: '/manager',
})

test('actionKinds of no alerts is empty', () => {
  assert.deepEqual(actionKinds([]), [])
})

test('actionKinds keeps severity order and drops link-only kinds', () => {
  assert.deepEqual(
    actionKinds([
      alert('reviewsPending', 'info'),
      alert('noHousekeeperOnShift', 'warning'),
      alert('refundsPending', 'warning'),
      alert('maintenanceCritical', 'critical'),
    ]),
    ['maintenanceCritical', 'refundsPending', 'reviewsPending'],
  )
})

test('actionKinds skips kinds whose count is 0', () => {
  assert.deepEqual(actionKinds([alert('refundsPending', 'warning', 0)]), [])
})

test('seeAllShown when fewer items are listed than the alert counts', () => {
  assert.equal(seeAllShown(5, 8), true) // over the limit
  assert.equal(seeAllShown(0, 3), true) // counted but none loaded (older than the list window)
  assert.equal(seeAllShown(3, 3), false)
})
