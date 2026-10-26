import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskPhone } from './phone'

test('maskPhone: 10-digit Thai mobile', () => {
  assert.equal(maskPhone('0612345687'), '061-xxx-xx87')
  assert.equal(maskPhone('061-234-5687'), '061-xxx-xx87')
})

test('maskPhone: other lengths keep first 3 and last 2', () => {
  assert.equal(maskPhone('021234567'), '021-xxxx-67')
  assert.equal(maskPhone('+66612345687'), '666-xxxxxx-87')
})

test('maskPhone: empty and too short', () => {
  assert.equal(maskPhone(null), null)
  assert.equal(maskPhone(''), null)
  assert.equal(maskPhone('1234'), 'xxx')
})
