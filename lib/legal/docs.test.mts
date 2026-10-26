/**
 * Unit tests for the legal-document ids.
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEGAL_DOC_COLUMN, isLegalDoc, legalDocFor, legalFileUrl } from './docs'

test('legalFileUrl points at the same-origin PDF route', () => {
  assert.equal(legalFileUrl('terms-en', 'abc'), '/legal-files/terms-en?v=abc')
  assert.equal(legalFileUrl('privacy-th', 'draft'), '/legal-files/privacy-th?v=draft')
})

test('legalDocFor maps document kind + locale to a doc id', () => {
  assert.equal(legalDocFor('privacy', 'th'), 'privacy-th')
  assert.equal(legalDocFor('terms', 'en'), 'terms-en')
})

test('isLegalDoc accepts only the four ids', () => {
  assert.equal(isLegalDoc('privacy-th'), true)
  assert.equal(isLegalDoc('privacy-xx'), false)
  assert.equal(isLegalDoc(''), false)
})

test('each doc maps to its legal_versions / legal_draft column', () => {
  assert.equal(LEGAL_DOC_COLUMN['terms-en'], 'terms_en_key')
  assert.equal(LEGAL_DOC_COLUMN['privacy-th'], 'privacy_th_key')
})
