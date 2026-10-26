/**
 * Unit tests for the "can the admin publish?" rule (mirrors the
 * publish_legal_version() RPC).
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canPublish } from './publish-rule'
import type { LegalKeys } from './docs'

const empty: LegalKeys = { 'privacy-th': null, 'privacy-en': null, 'terms-th': null, 'terms-en': null }
const current: LegalKeys = {
  'privacy-th': 'legal/p-th.pdf',
  'privacy-en': 'legal/p-en.pdf',
  'terms-th': 'legal/t-th.pdf',
  'terms-en': 'legal/t-en.pdf',
}

test('an empty draft has nothing to publish', () => {
  assert.deepEqual(canPublish(empty, current), { ok: false, reason: 'NOTHING_TO_PUBLISH' })
})

test('first publish needs all four documents', () => {
  assert.deepEqual(canPublish({ ...empty, 'privacy-th': 'legal/new.pdf' }, null), {
    ok: false,
    reason: 'INCOMPLETE',
    missing: ['privacy-en', 'terms-th', 'terms-en'],
  })
})

test('a partial draft is merged with the current version', () => {
  const r = canPublish({ ...empty, 'privacy-th': 'legal/new.pdf' }, current)
  assert.equal(r.ok, true)
  assert.ok(r.ok)
  assert.equal(r.merged['privacy-th'], 'legal/new.pdf')
  assert.equal(r.merged['terms-en'], 'legal/t-en.pdf')
})

test('a full draft publishes with no current version', () => {
  assert.equal(canPublish(current, null).ok, true)
})
