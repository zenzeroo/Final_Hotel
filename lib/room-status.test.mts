/**
 * Unit tests for which room statuses can take a check-in.
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCheckInReady, splitCheckInUnits, roomLockReason, RECEPTION_SETTABLE_STATUSES } from './room-status'

test('roomLockReason: a staying guest locks the room, whatever its status says', () => {
  assert.equal(roomLockReason('occupied', false), 'occupied')
  assert.equal(roomLockReason('available', true), 'occupied') // status drifted, booking is checked in
})

test('roomLockReason: closed rooms are manager-only, the rest are free to change', () => {
  assert.equal(roomLockReason('maintenance', false), 'closed')
  assert.equal(roomLockReason('out_of_order', false), 'closed')
  for (const s of ['available', 'ready', 'waiting_cleaning', 'cleaning', 'inspection', 'checkout']) {
    assert.equal(roomLockReason(s, false), null, s)
  }
})

test('reception can set only the cleaning-flow statuses', () => {
  assert.deepEqual([...RECEPTION_SETTABLE_STATUSES], ['waiting_cleaning', 'cleaning', 'ready'])
})

test('splitCheckInUnits: booked room type first, other ready rooms as alternatives', () => {
  const units = [
    { id: 'p01', roomTypeId: 'garden', status: 'ready' },
    { id: 'v01', roomTypeId: 'villa', status: 'available' },
    { id: '303', roomTypeId: 'twin', status: 'cleaning' },
    { id: '304', roomTypeId: 'heritage', status: 'ready' },
  ]
  const { booked, others } = splitCheckInUnits(units, 'garden')
  assert.deepEqual(booked.map((u) => u.id), ['p01'])
  assert.deepEqual(others.map((u) => u.id), ['v01', '304']) // 303 is not ready
})

test('splitCheckInUnits: booked room not ready → only alternatives', () => {
  const { booked, others } = splitCheckInUnits(
    [
      { id: 'p01', roomTypeId: 'garden', status: 'inspection' },
      { id: '304', roomTypeId: 'heritage', status: 'ready' },
    ],
    'garden',
  )
  assert.equal(booked.length, 0)
  assert.deepEqual(others.map((u) => u.id), ['304'])
})

test('splitCheckInUnits: reports the booked type\'s rooms that are not ready', () => {
  const { bookedNotReady } = splitCheckInUnits(
    [
      { id: 'p01', roomTypeId: 'garden', status: 'inspection' },
      { id: 'p02', roomTypeId: 'garden', status: 'ready' },
      { id: '202', roomTypeId: 'forest', status: 'waiting_cleaning' },
    ],
    'garden',
  )
  assert.deepEqual(bookedNotReady.map((u) => u.id), ['p01'])
})

test('cleaned rooms ("ready") and legacy "available" rooms can take a check-in', () => {
  assert.equal(isCheckInReady('ready'), true)
  assert.equal(isCheckInReady('available'), true)
})

test('rooms in the cleaning flow, occupied or closed cannot', () => {
  for (const s of ['occupied', 'waiting_cleaning', 'cleaning', 'inspection', 'maintenance', 'out_of_order', 'checkout']) {
    assert.equal(isCheckInReady(s), false, s)
  }
})
