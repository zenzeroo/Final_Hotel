'use client'

import { useTransition } from 'react'
import { startTask, completeTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { HousekeepingTaskStatus } from '@/lib/data/types'

export function TaskActions({
  taskId,
  status,
}: {
  taskId: string
  status: HousekeepingTaskStatus
}) {
  const [isPending, startTransition] = useTransition()

  if (status !== 'assigned' && status !== 'in_progress') return null

  function handle(action: 'start' | 'complete') {
    if (action === 'start' && !confirm('Start this task? Room status will change to cleaning.')) return
    if (action === 'complete' && !confirm('Mark as completed? This will mark the room available.')) return
    startTransition(async () => {
      const fn = action === 'start' ? startTask : completeTask
      const result = await fn(taskId)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <div className="flex gap-2">
      {status === 'assigned' && (
        <button
          onClick={() => handle('start')}
          disabled={isPending}
          className="px-3 py-1.5 bg-primary text-secondary rounded-md text-caption uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <MaterialIcon name="play_arrow" size={16} />
          Start
        </button>
      )}
      {status === 'in_progress' && (
        <button
          onClick={() => handle('complete')}
          disabled={isPending}
          className="px-3 py-1.5 bg-secondary text-primary rounded-md text-caption uppercase tracking-wider hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <MaterialIcon name="check" size={16} />
          Complete
        </button>
      )}
    </div>
  )
}