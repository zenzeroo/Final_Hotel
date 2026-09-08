'use client'

import { useState, useTransition } from 'react'
import { claimTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export function TaskClaimButton({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  function handleClick() {
    setConfirmMessage('รับงานนี้เลยไหม?')
  }

  async function handleConfirm() {
    setConfirmMessage(null)
    startTransition(async () => {
      const result = await claimTask(taskId)
      if (!result.ok) setAlertMessage(result.error)
    })
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="px-4 py-2 bg-primary text-on-primary rounded-md text-caption uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <MaterialIcon name="add_task" size={18} />
        {isPending ? 'กำลังรับงาน...' : 'รับงาน'}
      </button>
      {confirmMessage && (
        <ConfirmModal
          open
          body={confirmMessage}
          okLabel="รับงาน"
          onCancel={() => setConfirmMessage(null)}
          onConfirm={handleConfirm}
        />
      )}
      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </>
  )
}