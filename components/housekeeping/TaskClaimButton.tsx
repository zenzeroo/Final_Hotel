'use client'

import { useState, useTransition } from 'react'
import { claimTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'

export function TaskClaimButton({ taskId }: { taskId: string }) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const toast = useToast()

  function handleClick() {
    setConfirmMessage(t('staff.taskAction.confirmClaim'))
  }

  async function handleConfirm() {
    setConfirmMessage(null)
    startTransition(async () => {
      const result = await claimTask(taskId)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full sm:w-auto justify-center min-h-11 px-5 bg-primary text-on-primary rounded-lg text-[14px] font-semibold hover:bg-primary-container active:translate-y-px transition-[background-color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50 flex items-center gap-2"
      >
        <MaterialIcon name="add_task" size={18} />
        {isPending ? t('staff.taskAction.claiming') : t('staff.taskAction.claim')}
      </button>
      {confirmMessage && (
        <ConfirmModal
          open
          body={confirmMessage}
          okLabel={t('staff.taskAction.claim')}
          onCancel={() => setConfirmMessage(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}