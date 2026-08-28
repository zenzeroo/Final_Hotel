'use client'

import { useTransition } from 'react'
import { claimTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export function TaskClaimButton({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('รับงานนี้เลยไหม?')) return
    startTransition(async () => {
      const result = await claimTask(taskId)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-4 py-2 bg-primary text-secondary rounded-md text-caption uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-2"
    >
      <MaterialIcon name="add_task" size={18} />
      {isPending ? 'กำลังรับงาน...' : 'รับงาน'}
    </button>
  )
}