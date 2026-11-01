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
  size = 'md',
}: {
  taskId: string
  status: HousekeepingTaskStatus
  /** `lg`: one full-width thumb-sized button (the dashboard's next task). */
  size?: 'md' | 'lg'
}) {
  const t = useT()
  const button =
    size === 'lg'
      ? 'w-full h-12 px-6 rounded-xl text-body-md font-semibold justify-center'
      : 'w-full sm:w-auto min-h-11 px-4 rounded-lg text-[14px] font-semibold justify-center'
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
      <div className={size === 'lg' ? 'flex' : 'flex gap-2 w-full sm:w-auto'}>
        {status === 'assigned' && (
          <button
            onClick={() => setConfirmAction('start')}
            disabled={isPending}
            className={`${button} bg-primary text-on-primary hover:bg-primary-container active:translate-y-px transition-[background-color,transform] disabled:opacity-50 inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary`}
          >
            <MaterialIcon name="play_arrow" size={size === 'lg' ? 22 : 18} />
            {t('staff.taskAction.start')}
          </button>
        )}
        {status === 'in_progress' && (
          <button
            onClick={() => setConfirmAction('complete')}
            disabled={isPending}
            className={`${button} bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-on-secondary active:translate-y-px transition-[background-color,color,transform] disabled:opacity-50 inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary`}
          >
            <MaterialIcon name="check" size={size === 'lg' ? 22 : 18} />
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