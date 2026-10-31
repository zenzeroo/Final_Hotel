import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ilikePattern } from './ilike'

test('ilikePattern: wraps a plain term', () => {
  assert.equal(ilikePattern('ZZR-51A95'), '%ZZR-51A95%')
  assert.equal(ilikePattern('  สมชาย  '), '%สมชาย%')
})

test('ilikePattern: strips characters that break a PostgREST or() filter', () => {
  assert.equal(ilikePattern('Smith, John'), '%Smith John%')
  assert.equal(ilikePattern('a(b)c'), '%a b c%')
  assert.equal(ilikePattern('x"y\'z\\w'), '%x y z w%')
  assert.equal(ilikePattern('name.ilike.%,id.eq.1'), '%name.ilike. id.eq.1%')
})

test('ilikePattern: wildcards from the user are not wildcards', () => {
  assert.equal(ilikePattern('100%'), '%100%')
  assert.equal(ilikePattern('a_b*c'), '%a b c%')
})

test('ilikePattern: nothing searchable → null', () => {
  assert.equal(ilikePattern(''), null)
  assert.equal(ilikePattern(undefined), null)
  assert.equal(ilikePattern(' , ( ) '), null)
})

test('ilikePattern: capped at 100 characters', () => {
  assert.equal(ilikePattern('a'.repeat(150))?.length, 102)
})
