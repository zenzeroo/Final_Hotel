/**
 * Every notification type needs text in both languages (Phase 60).
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NOTIFICATION_ICON, NOTIFICATION_TYPES } from './types'
import { th } from '@/lib/i18n/dictionaries/th'
import { en } from '@/lib/i18n/dictionaries/en'

test('every type has TH + EN text and an icon', () => {
  for (const type of NOTIFICATION_TYPES) {
    assert.ok(th.notifications.types[type], `th missing ${type}`)
    assert.ok(en.notifications.types[type], `en missing ${type}`)
    assert.ok(NOTIFICATION_ICON[type], `icon missing ${type}`)
  }
})

test('TH and EN use the same placeholders', () => {
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
  for (const type of NOTIFICATION_TYPES) {
    assert.deepEqual(
      placeholders(en.notifications.types[type]),
      placeholders(th.notifications.types[type]),
      type,
    )
  }
})
