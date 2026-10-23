/**
 * Unit tests for the housekeeping auto-allocation algorithm (Phase 30).
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateTasks,
  type HousekeeperInput,
  type TaskInput,
} from './housekeeping-allocation'

const hk = (id: string, floors: number[] = [], isAvailable = true): HousekeeperInput => ({
  id,
  fullName: id,
  isAvailable,
  defaultFloors: new Set(floors),
})

const task = (id: string, over: Partial<TaskInput> = {}): TaskInput => ({
  id,
  roomUnitId: `room-${id}`,
  floor: 1,
  estimatedMinutes: 20,
  priority: 'normal',
  nextCheckIn: null,
  taskType: 'cleaning',
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
})

test('no housekeeper on shift → every task unassigned with a warning', () => {
  const out = allocateTasks({ housekeepers: [hk('a', [], false)], tasks: [task('t1'), task('t2')] })
  assert.deepEqual(out.assignments, [])
  assert.deepEqual(out.unassignedTaskIds, ['t1', 't2'])
  assert.equal(out.warnings.length, 1)
})

test('equal tasks with no floor preference are spread across housekeepers', () => {
  const out = allocateTasks({
    housekeepers: [hk('a'), hk('b')],
    tasks: [task('t1'), task('t2', { floor: 2 }), task('t3', { floor: 3 }), task('t4', { floor: 4 })],
  })
  assert.equal(out.assignments.length, 4)
  assert.equal(out.loadByHousekeeper.a, 40)
  assert.equal(out.loadByHousekeeper.b, 40)
})

test('a floor default wins the task for that floor', () => {
  const out = allocateTasks({
    housekeepers: [hk('a'), hk('b', [3])],
    tasks: [task('t1', { floor: 3 })],
  })
  assert.equal(out.assignments[0].housekeeperId, 'b')
})

test('every task is assigned exactly once and loads add up', () => {
  const tasks = Array.from({ length: 7 }, (_, i) =>
    task(`t${i}`, { floor: (i % 3) + 1, estimatedMinutes: 20 + i * 5 }),
  )
  const out = allocateTasks({ housekeepers: [hk('a', [1]), hk('b', [2]), hk('c')], tasks })
  const ids = out.assignments.map((a) => a.taskId).sort()
  assert.deepEqual(ids, tasks.map((t) => t.id).sort())
  const total = Object.values(out.loadByHousekeeper).reduce((s, n) => s + n, 0)
  assert.equal(total, tasks.reduce((s, t) => s + t.estimatedMinutes, 0))
})

test('urgent tasks are placed before normal ones', () => {
  const out = allocateTasks({
    housekeepers: [hk('a')],
    tasks: [task('normal'), task('urgent', { priority: 'urgent' })],
  })
  assert.deepEqual(out.assignments.map((a) => a.taskId), ['urgent', 'normal'])
})

test('a housekeeper left with no work triggers the idle warning', () => {
  const out = allocateTasks({ housekeepers: [hk('a'), hk('b')], tasks: [task('t1')] })
  assert.ok(out.warnings.some((w) => w.includes('0 tasks')))
})
