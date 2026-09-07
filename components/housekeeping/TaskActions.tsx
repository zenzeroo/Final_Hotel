'use client'

import { useState, useTransition } from 'react'
import { startTask, completeTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { HousekeepingTaskStatus } from '@/lib/data/types'

export function TaskActions({
  taskId,
  status,
}: {
  taskId: string
  status: HousekeepingTaskStatus
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmAction, setConfirmAction] = useState<'start' | 'complete' | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  if (status !== 'assigned' && status !== 'in_progress') return null

  function getConfirmMessage(action: 'start' | 'complete'): string {
    return action === 'start'
      ? 'เริ่มงานนี้เลยไหม? สถานะห้องจะเปลี่ยนเป็นกำลังทำความสะอาด'
      : 'บันทึกว่าเสร็จสิ้นเลยไหม? ห้องจะกลับเป็นสถานะว่าง'
  }

  function handleConfirm() {
    const action = confirmAction
    setConfirmAction(null)
    if (!action) return
    startTransition(async () => {
      const fn = action === 'start' ? startTask : completeTask
      const result = await fn(taskId)
      if (!result.ok) setAlertMessage(result.error)
    })
  }

  return (
    <>
      <div className="flex gap-2">
        {status === 'assigned' && (
          <button
            onClick={() => setConfirmAction('start')}
            disabled={isPending}
            className="px-3 py-1.5 bg-primary text-secondary rounded-md text-caption uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <MaterialIcon name="play_arrow" size={16} />
            เริ่ม
          </button>
        )}
        {status === 'in_progress' && (
          <button
            onClick={() => setConfirmAction('complete')}
            disabled={isPending}
            className="px-3 py-1.5 bg-secondary text-primary rounded-md text-caption uppercase tracking-wider hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <MaterialIcon name="check" size={16} />
            เสร็จสิ้น
          </button>
        )}
      </div>
      {confirmAction && (
        <ConfirmModal
          open
          body={getConfirmMessage(confirmAction)}
          okLabel={confirmAction === 'start' ? 'เริ่ม' : 'เสร็จสิ้น'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
        />
      )}
      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </>
  )
}