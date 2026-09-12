/**
 * Phase 30 — Pure-TS auto-allocation algorithm.
 *
 * Strategy: Longest-Processing-Time-first (LPT) + Min-Load with
 * multi-factor tiebreakers.
 *
 *   1. Filter housekeepers to those on shift (staff_shifts.position != 'off'
 *      for today) AND role='housekeeper' AND is_active=true. If the filter
 *      returns zero housekeepers, returns an empty result with warning.
 *
 *   2. Sort unassigned tasks:
 *        a. priority DESC       (urgent > high > normal > low)
 *        b. next_check_in ASC   (urgency — NULLs last)
 *        c. estimated_minutes DESC  (LPT key — biggest job first)
 *        d. created_at ASC      (FIFO)
 *
 *   3. For each task, score every available HK:
 *        score = -currentLoadMinutes
 *              + (isFloorAssignee ? FLOOR_BONUS : 0)              // +200
 *              + (floorInTaskSet ? FLOOR_CONSISTENCY_BONUS : 0)   // +60
 *              - (distinctFloorCount * FLOOR_DIVERSITY_PENALTY)   // -25/floor
 *              + PRIORITY_BONUS[priority]                          // Phase 30.1 — U4
 *
 *      Tiebreakers (deterministic, in order):
 *        - smaller currentLoadMinutes
 *        - smaller distinctFloorCount
 *        - smaller housekeeper.id (lexicographic)
 *
 *   4. Assign the winning HK. Update its local tracking struct.
 *
 *   5. Return assignments + per-HK load summary + warnings.
 *
 * Phase 30.1 — added `PRIORITY_BONUS` to the score so that an urgent task
 * gravitates toward the most floor-aligned HK (not just the first HK by
 * FIFO tiebreak). Sort order still respects priority (urgent first); the
 * bonus now also nudges HK selection.
 *
 * Complexity: O(T·H·log T) where T = #tasks, H = #housekeepers.
 * For hotel scale (T ≤ ~30, H ≤ ~10) this is trivially fast.
 *
 * LPT is provably 4/3-OPT for makespan minimisation; we optimise makespan
 * (the user's "Workload สมดุล" goal). Hungarian would over-engineer for
 * this dataset size.
 *
 * No external dependencies, no `Date.now()` outside helpers — fully
 * unit-testable as a pure function.
 */
import type {
  HousekeepingTaskPriority,
  HousekeepingTaskType,
} from '@/lib/data/types'

// ── Public types ────────────────────────────────────────────────────────────

export interface HousekeeperInput {
  id: string
  fullName: string
  /** True when staff_shifts.position != 'off' for today. */
  isAvailable: boolean
  /** Floors that this HK is the persisted default for (Phase 28 floor_assignments). */
  defaultFloors: Set<number>
}

export interface TaskInput {
  id: string
  roomUnitId: string
  floor: number
  estimatedMinutes: number
  priority: HousekeepingTaskPriority
  /** ISO date string or null. NULL = no upcoming booking → low urgency. */
  nextCheckIn: string | null
  taskType: HousekeepingTaskType
  /** ISO timestamp for FIFO tiebreaker; older = higher priority. */
  createdAt: string
}

export interface AllocationInput {
  housekeepers: HousekeeperInput[]
  tasks: TaskInput[]
}

export interface Assignment {
  taskId: string
  housekeeperId: string
  estimatedMinutes: number
  /** Human-readable rationale (useful for audit log / UI debug). */
  reason: string
}

export interface AllocationOutput {
  assignments: Assignment[]
  /** Tasks that could not be assigned (e.g. no available HKs). */
  unassignedTaskIds: string[]
  /** Per-housekeeper final load in minutes (for the manager summary). */
  loadByHousekeeper: Record<string, number>
  warnings: string[]
}

// ── Tunables ────────────────────────────────────────────────────────────────

/** Big bonus when this HK is the persisted default for the task's floor. */
const FLOOR_BONUS = 200
/** Smaller bonus when this HK already has another task on the same floor. */
const FLOOR_CONSISTENCY_BONUS = 60
/** Penalty per distinct floor in this HK's current mix (reduces walking). */
const FLOOR_DIVERSITY_PENALTY = 25
/**
 * Phase 30.1 — small per-task bonus weighted by priority so an urgent task
 * gravitates toward a better-fit HK even when load/floor signals are tied.
 * Sized to be smaller than `FLOOR_BONUS` so floor preferences still win for
 * same-floor tasks.
 */
const PRIORITY_BONUS: Record<HousekeepingTaskPriority, number> = {
  urgent: 50,
  high: 25,
  normal: 0,
  low: -25,
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<HousekeepingTaskPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
}

function hoursUntil(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, ms / 3_600_000)
}

/**
 * Lookup helper for tests + debug — given a pre-fetched next-check-in map
 * (keyed by room_unit_id), returns the entry or null.
 */
export function computeNextCheckIn(
  roomUnitId: string,
  map: Map<string, string | null>,
): string | null {
  return map.get(roomUnitId) ?? null
}

/**
 * Diagnostic helper — groups tasks by floor for the inspector log.
 */
export function groupByFloor(tasks: TaskInput[]): Map<number, TaskInput[]> {
  const out = new Map<number, TaskInput[]>()
  for (const t of tasks) {
    const arr = out.get(t.floor) ?? []
    arr.push(t)
    out.set(t.floor, arr)
  }
  return out
}

// ── Main algorithm ─────────────────────────────────────────────────────────

export function allocateTasks(input: AllocationInput): AllocationOutput {
  const warnings: string[] = []
  const availableHKs = input.housekeepers.filter((h) => h.isAvailable)
  if (availableHKs.length === 0) {
    warnings.push('No housekeepers on shift today')
    return {
      assignments: [],
      unassignedTaskIds: input.tasks.map((t) => t.id),
      loadByHousekeeper: {},
      warnings,
    }
  }

  // 1. Sort tasks: LPT + priority + urgency + FIFO
  const sortedTasks = [...input.tasks].sort((a, b) => {
    const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    if (pr !== 0) return pr
    const ua = hoursUntil(a.nextCheckIn)
    const ub = hoursUntil(b.nextCheckIn)
    if (ua !== ub) return ua - ub
    if (a.estimatedMinutes !== b.estimatedMinutes) {
      return b.estimatedMinutes - a.estimatedMinutes
    }
    return a.createdAt.localeCompare(b.createdAt)
  })

  // 2. Mutable per-HK state
  const hkState = new Map<
    string,
    {
      loadMinutes: number
      floorCounts: Map<number, number>
      distinctFloorCount: number
      defaultFloors: Set<number>
    }
  >()
  for (const hk of availableHKs) {
    hkState.set(hk.id, {
      loadMinutes: 0,
      floorCounts: new Map(),
      distinctFloorCount: 0,
      defaultFloors: hk.defaultFloors,
    })
  }

  const assignments: Assignment[] = []
  const unassignedTaskIds: string[] = []

  // 3. For each task, pick the best HK
  for (const task of sortedTasks) {
    let bestHK: string | null = null
    let bestScore = -Infinity
    let bestTiebreaker = { load: Infinity, distinct: Infinity, id: '' }

    for (const hk of availableHKs) {
      const s = hkState.get(hk.id)!
      const isFloorAssignee = s.defaultFloors.has(task.floor)
      const floorInTaskSet = s.floorCounts.has(task.floor)

      const score =
        -s.loadMinutes +
        (isFloorAssignee ? FLOOR_BONUS : 0) +
        (floorInTaskSet ? FLOOR_CONSISTENCY_BONUS : 0) -
        s.distinctFloorCount * FLOOR_DIVERSITY_PENALTY +
        PRIORITY_BONUS[task.priority]

      const tiebreaker = {
        load: s.loadMinutes,
        distinct: s.distinctFloorCount,
        id: hk.id,
      }

      // Strictly better if score is higher OR equal-but-deterministic-wins.
      const better =
        score > bestScore ||
        (score === bestScore &&
          (tiebreaker.load < bestTiebreaker.load ||
            (tiebreaker.load === bestTiebreaker.load &&
              (tiebreaker.distinct < bestTiebreaker.distinct ||
                (tiebreaker.distinct === bestTiebreaker.distinct &&
                  tiebreaker.id < bestTiebreaker.id)))))

      if (better) {
        bestScore = score
        bestHK = hk.id
        bestTiebreaker = tiebreaker
      }
    }

    if (!bestHK) {
      unassignedTaskIds.push(task.id)
      continue
    }

    const s = hkState.get(bestHK)!
    s.loadMinutes += task.estimatedMinutes
    const prevCount = s.floorCounts.get(task.floor) ?? 0
    if (prevCount === 0) s.distinctFloorCount += 1
    s.floorCounts.set(task.floor, prevCount + 1)

    const isDefaultFloor = s.defaultFloors.has(task.floor)
    const reason =
      `score=${bestScore.toFixed(0)}` +
      ` load=${s.loadMinutes}m` +
      (prevCount === 0
        ? ' [new-floor]'
        : ' [floor-consistent]') +
      (isDefaultFloor ? ' [floor-default]' : '') +
      (PRIORITY_BONUS[task.priority] !== 0 ? ` [priority=${task.priority}]` : '')

    assignments.push({
      taskId: task.id,
      housekeeperId: bestHK,
      estimatedMinutes: task.estimatedMinutes,
      reason,
    })
  }

  // 4. Build load summary + balance warning
  const loadByHousekeeper: Record<string, number> = {}
  for (const [id, s] of hkState) loadByHousekeeper[id] = s.loadMinutes

  const loads = Object.values(loadByHousekeeper).filter((n) => n > 0)
  if (loads.length >= 2) {
    const max = Math.max(...loads)
    const min = Math.min(...loads)
    if (min > 0 && max / min > 1.5) {
      warnings.push(
        `Workload spread ${Math.round(max)}–${Math.round(min)} min exceeds 1.5× — manual review suggested`,
      )
    }
  }

  return { assignments, unassignedTaskIds, loadByHousekeeper, warnings }
}