'use client'

import { useState, useTransition } from 'react'
import { startTask, completeTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { HousekeepingTaskStatus } from '@/lib/data/types'
import { useT } from '@/lib/i18n/useT'

export function TaskActions({
  taskId,
  status,
}: {
  taskId: string
  status: HousekeepingTaskStatus
}) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [confirmAction, setConfirmAction] = useState<'start' | 'complete' | null>(null)
  const toast = useToast()

  if (status !== 'assigned' && status !== 'in_progress') return null

  function getConfirmMessage(action: 'start' | 'complete'): string {
    return action === 'start'
      ? t('staff.taskAction.confirmStart')
      : t('staff.taskAction.confirmComplete')
  }

  function handleConfirm() {
    const action = confirmAction
    setConfirmAction(null)
    if (!action) return
    startTransition(async () => {
      const fn = action === 'start' ? startTask : completeTask
      const result = await fn(taskId)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <>
      <div className="flex gap-2">
        {status === 'assigned' && (
          <button
            onClick={() => setConfirmAction('start')}
            disabled={isPending}
            className="px-3 py-1.5 bg-primary text-on-primary rounded-md text-caption uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <MaterialIcon name="play_arrow" size={16} />
            {t('staff.taskAction.start')}
          </button>
        )}
        {status === 'in_progress' && (
          <button
            onClick={() => setConfirmAction('complete')}
            disabled={isPending}
            className="px-3 py-1.5 bg-secondary-container text-on-secondary-container rounded-md text-caption uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <MaterialIcon name="check" size={16} />
            {t('staff.taskAction.complete')}
          </button>
        )}
      </div>
      {confirmAction && (
        <ConfirmModal
          open
          body={getConfirmMessage(confirmAction)}
          okLabel={confirmAction === 'start' ? t('staff.taskAction.start') : t('staff.taskAction.complete')}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}