/**
 * Unit tests for the uploaded legal PDF check.
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEGAL_PDF_MAX_BYTES, validateLegalPdf } from './pdf-validate'

const pdfHead = new TextEncoder().encode('%PDF-1.7')
const zipHead = new Uint8Array([0x50, 0x4b, 0x03, 0x04]) // a .docx renamed to .pdf

test('empty file is rejected', () => {
  assert.deepEqual(validateLegalPdf({ type: 'application/pdf', size: 0, head: pdfHead }), {
    ok: false,
    reason: 'empty',
  })
})

test('non-PDF mime type is rejected', () => {
  assert.deepEqual(validateLegalPdf({ type: 'image/png', size: 100, head: pdfHead }), {
    ok: false,
    reason: 'type',
  })
})

test('size limit is 4 MB — under the 5 MB server-action body limit and Vercel\'s 4.5 MB request cap', () => {
  assert.equal(LEGAL_PDF_MAX_BYTES, 4 * 1024 * 1024)
})

test('size limit is inclusive', () => {
  assert.deepEqual(
    validateLegalPdf({ type: 'application/pdf', size: LEGAL_PDF_MAX_BYTES + 1, head: pdfHead }),
    { ok: false, reason: 'size' },
  )
  assert.deepEqual(
    validateLegalPdf({ type: 'application/pdf', size: LEGAL_PDF_MAX_BYTES, head: pdfHead }),
    { ok: true },
  )
})

test('a renamed .docx (zip magic) is rejected', () => {
  assert.deepEqual(validateLegalPdf({ type: 'application/pdf', size: 100, head: zipHead }), {
    ok: false,
    reason: 'magic',
  })
})

test('a real PDF passes', () => {
  assert.deepEqual(validateLegalPdf({ type: 'application/pdf', size: 100, head: pdfHead }), {
    ok: true,
  })
})
