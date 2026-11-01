import type { HousekeepingTask, HousekeepingTaskPriority } from '@/lib/data/types'

const PRIORITY_RANK: Record<HousekeepingTaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

/**
 * Tasks in the order a housekeeper works them: the one already started,
 * then by priority, then the room whose next guest arrives first.
 * Used by the dashboard's "next task" and the /housekeeper/tasks list.
 */
export function inWorkingOrder<T extends Pick<HousekeepingTask, 'status' | 'priority' | 'next_check_in'>>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'in_progress') return -1
      if (b.status === 'in_progress') return 1
    }
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (p !== 0) return p
    return (a.next_check_in ?? '9999').localeCompare(b.next_check_in ?? '9999')
  })
}
