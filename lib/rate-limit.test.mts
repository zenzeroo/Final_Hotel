/**
 * Unit tests for the in-memory token bucket.
 * Run with:  npm run test:unit
 */

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit, getClientIp } from './rate-limit'

test('fresh bucket allows and reports remaining tokens', () => {
  const r = checkRateLimit('10.0.0.1', '/login')
  assert.deepEqual(r, { allowed: true, remaining: 9, limit: 10 })
})

test('burst past the route limit is refused with Retry-After', () => {
  for (let i = 0; i < 5; i++) assert.equal(checkRateLimit('10.0.0.2', '/register')?.allowed, true)
  const r = checkRateLimit('10.0.0.2', '/register')
  assert.equal(r?.allowed, false)
  if (r && !r.allowed) {
    assert.equal(r.limit, 5)
    assert.ok(r.retryAfterSeconds > 0 && r.retryAfterSeconds <= 60)
  }
})

test('buckets are isolated per IP and per route', () => {
  for (let i = 0; i < 5; i++) checkRateLimit('10.0.0.3', '/register')
  assert.equal(checkRateLimit('10.0.0.3', '/register')?.allowed, false)
  assert.equal(checkRateLimit('10.0.0.4', '/register')?.allowed, true)
  assert.equal(checkRateLimit('10.0.0.3', '/login')?.allowed, true)
})

test('routes outside the list are not limited (server actions, Stripe webhook)', () => {
  assert.equal(checkRateLimit('10.0.0.5', '/some/other/path'), null)
  assert.equal(checkRateLimit('10.0.0.5', '/api/payments/webhook'), null)
  assert.equal(checkRateLimit('10.0.0.5', '/loginx'), null)
})

test('nested paths share the prefix limit', () => {
  assert.equal(checkRateLimit('10.0.0.9', '/reset-password/confirm')?.limit, 10)
})

test('tokens refill continuously: one per window/max', () => {
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 })
  try {
    for (let i = 0; i < 5; i++) checkRateLimit('10.0.0.6', '/register')
    assert.equal(checkRateLimit('10.0.0.6', '/register')?.allowed, false)
    mock.timers.tick(12_000) // 60s / 5 tokens
    assert.equal(checkRateLimit('10.0.0.6', '/register')?.allowed, true)
    assert.equal(checkRateLimit('10.0.0.6', '/register')?.allowed, false)
  } finally {
    mock.timers.reset()
  }
})

test('a full window refills the whole bucket, not one token', () => {
  mock.timers.enable({ apis: ['Date'], now: 2_000_000 })
  try {
    for (let i = 0; i < 10; i++) checkRateLimit('10.0.0.7', '/login')
    assert.equal(checkRateLimit('10.0.0.7', '/login')?.allowed, false)
    mock.timers.tick(60_000)
    for (let i = 0; i < 10; i++) assert.equal(checkRateLimit('10.0.0.7', '/login')?.allowed, true, `request ${i + 1}`)
    const r = checkRateLimit('10.0.0.7', '/login')
    assert.equal(r?.allowed, false)
    if (r && !r.allowed) assert.equal(r.retryAfterSeconds, 6) // 60s / 10 tokens
  } finally {
    mock.timers.reset()
  }
})

test('getClientIp reads X-Forwarded-For, then X-Real-IP, then unknown', () => {
  const req = (h: Record<string, string>) => new Request('http://x.test/', { headers: h })
  assert.equal(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })), '1.2.3.4')
  assert.equal(getClientIp(req({ 'x-real-ip': '9.9.9.9' })), '9.9.9.9')
  assert.equal(getClientIp(req({})), 'unknown')
})
