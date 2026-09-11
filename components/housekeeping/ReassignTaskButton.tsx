'use client'

import { AssignTaskButton } from './AssignTaskButton'
import type { HousekeeperOption } from '@/lib/data/types'

interface ReassignTaskButtonProps {
  taskId: string
  housekeepers: HousekeeperOption[]
  currentAssigneeId: string
}

/**
 * Phase 28 — wrapper that flips the button copy to "Reassign" and
 * pre-fills the picker with the current assignee. Visual API stays
 * identical to AssignTaskButton.
 */
export function ReassignTaskButton({ taskId, housekeepers, currentAssigneeId }: ReassignTaskButtonProps) {
  return (
    <AssignTaskButton
      taskId={taskId}
      housekeepers={housekeepers}
      currentAssigneeId={currentAssigneeId}
      compact
    />
  )
}