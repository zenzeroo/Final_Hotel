/**
 * Unit tests for which room statuses can take a check-in.
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isCheckInReady,
  splitCheckInUnits,
  notReadyReason,
  planRooms,
  inArrivalOrder,
} from './room-status'

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

test('notReadyReason: guest staying wins over the status', () => {
  assert.deepEqual(notReadyReason('occupied', { guestUntil: '2026-10-28' }), { kind: 'guest', until: '2026-10-28' })
  assert.deepEqual(notReadyReason('cleaning', { hasGuest: true, guestUntil: '2026-10-28' }), {
    kind: 'guest',
    until: '2026-10-28',
  })
})

test('notReadyReason: cleaning flow names the housekeeper', () => {
  assert.deepEqual(notReadyReason('waiting_cleaning', { cleanerName: 'Somjit' }), { kind: 'waiting_cleaning', by: 'Somjit' })
  assert.deepEqual(notReadyReason('cleaning'), { kind: 'cleaning', by: null })
  assert.deepEqual(notReadyReason('inspection'), { kind: 'inspection' })
})

test('notReadyReason: closed room prefers the repair title, then damage', () => {
  assert.deepEqual(notReadyReason('maintenance', { repairTitle: 'ท่อรั่ว', damageDescription: 'กระจกแตก' }), {
    kind: 'repair',
    detail: 'ท่อรั่ว',
  })
  assert.deepEqual(notReadyReason('out_of_order', { damageDescription: 'กระจกแตก' }), { kind: 'damage', detail: 'กระจกแตก' })
  assert.deepEqual(notReadyReason('maintenance'), { kind: 'repair', detail: null })
})

test('splitCheckInUnits: other rooms only of types with room for the stay', () => {
  const units = [
    { id: 'a', roomTypeId: 'villa', status: 'occupied' },
    { id: 'b', roomTypeId: 'king', status: 'ready' },
    { id: 'c', roomTypeId: 'twin', status: 'available' },
  ]
  const all = splitCheckInUnits(units, 'villa')
  assert.deepEqual(all.others.map((u) => u.id), ['b', 'c'])
  const limited = splitCheckInUnits(units, 'villa', new Set(['twin']))
  assert.deepEqual(limited.others.map((u) => u.id), ['c'])
  assert.deepEqual(limited.bookedNotReady.map((u) => u.id), ['a'])
})

const booking = (id: string, status: string, roomUnit: string | null = null) => ({
  id,
  status,
  room_type_id: 'T',
  room_unit: roomUnit ? { unit_label: roomUnit } : null,
})
const unit = (id: string, label: string, status: string, roomTypeId: string | null = 'T') => ({
  id,
  unit_label: label,
  status,
  roomTypeId,
})

test('planRooms gives each ready room once, in list order', () => {
  const plans = planRooms(
    [booking('b1', 'confirmed'), booking('b2', 'confirmed')],
    [unit('u1', '101', 'ready'), unit('u2', '102', 'waiting_cleaning')],
  )
  assert.deepEqual(plans.get('b1'), { kind: 'ready', unitId: 'u1', room: '101' })
  assert.deepEqual(plans.get('b2'), { kind: 'blocked', unitId: 'u2', room: '102', status: 'waiting_cleaning' })
})

test('planRooms: checked-in booking keeps its room', () => {
  const plans = planRooms([booking('b1', 'checked_in', 'V-01')], [unit('u1', '101', 'ready')])
  assert.deepEqual(plans.get('b1'), { kind: 'staying', room: 'V-01' })
})

test('planRooms: type with no rooms → none', () => {
  const plans = planRooms([booking('b1', 'confirmed')], [unit('u9', '901', 'ready', 'OTHER')])
  assert.deepEqual(plans.get('b1'), { kind: 'none' })
})

test('inArrivalOrder sorts by check-in, then booking time, then id', () => {
  const rows = [
    { id: 'c', check_in: '2026-11-01', created_at: '2026-10-20T10:00:00Z' },
    { id: 'b', check_in: '2026-11-01', created_at: '2026-10-01T10:00:00Z' },
    { id: 'a', check_in: '2026-11-01', created_at: '2026-10-01T10:00:00Z' },
    { id: 'z', check_in: '2026-10-31', created_at: '2026-10-25T10:00:00Z' },
  ]
  assert.deepEqual(inArrivalOrder(rows).map((r) => r.id), ['z', 'a', 'b', 'c'])
})
