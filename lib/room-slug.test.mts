/**
 * Unit tests for the internal slug a new room gets from its number.
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roomSlugFor } from './room-slug'

test('roomSlugFor builds a lowercase slug from the room number and suffix', () => {
  assert.equal(roomSlugFor('P-01', 'a1b2c3'), 'room-p-01-a1b2c3')
  assert.equal(roomSlugFor('305', 'zz9'), 'room-305-zz9')
})

test('roomSlugFor always matches the slug rule (a-z, 0-9, -)', () => {
  const slug = roomSlugFor('  V 01/ห้อง ', 'Q7')
  assert.match(slug, /^[a-z0-9-]+$/)
  assert.ok(!slug.includes('--'), slug)
  assert.ok(!slug.endsWith('-'), slug)
})
