'use client'

import { useState, useTransition } from 'react'
import { assignTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { AlertModal } from '@/components/ui/AlertModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'
import type { HousekeeperOption } from '@/lib/data/types'

interface AssignTaskButtonProps {
  taskId: string
  housekeepers: HousekeeperOption[]
  /** Current assignee UUID — used to vary copy between 'assign' (null) and 'reassign' (set). */
  currentAssigneeId?: string | null
  /** Compact mode renders just the icon button (used inside cards/dense lists). */
  compact?: boolean
}

export function AssignTaskButton({
  taskId,
  housekeepers,
  currentAssigneeId,
  compact,
}: AssignTaskButtonProps) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const isReassign = !!currentAssigneeId && currentAssigneeId !== selectedId

  function openPicker() {
    setSelectedId(currentAssigneeId ?? '')
    setPickerOpen(true)
  }

  function requestConfirm() {
    if (!selectedId) {
      setAlertMessage(t('manager.housekeepingPage.notAssigned'))
      return
    }
    setPickerOpen(false)
    setConfirmMessage(
      isReassign
        ? t('manager.housekeepingPage.confirmReassign')
        : t('manager.housekeepingPage.confirmAssign'),
    )
  }

  async function handleConfirm() {
    setConfirmMessage(null)
    startTransition(async () => {
      const result = await assignTask(taskId, selectedId)
      if (!result.ok) {
        setAlertMessage(result.error)
      }
    })
  }

  const label = isReassign
    ? t('manager.housekeepingPage.reassign')
    : t('manager.housekeepingPage.assign')

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        disabled={isPending || housekeepers.length === 0}
        className={
          compact
            ? 'p-2 rounded-md text-on-surface-variant hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50'
            : 'px-4 py-2 bg-primary text-on-primary rounded-md text-caption uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-50 flex items-center gap-2'
        }
        title={label}
      >
        {compact ? (
          <MaterialIcon name="person_add" size={18} />
        ) : (
          <>
            <MaterialIcon name="person_add" size={18} />
            {label}
          </>
        )}
      </button>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={label}
        showCloseButton
        maxWidthClass="max-w-sm"
        body={
          <>
            <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">
              {t('manager.housekeepingPage.selectHousekeeper')}
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary mb-4"
            >
              <option value="">{t('manager.housekeepingPage.notAssigned')}</option>
              {housekeepers.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.fullName}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="flex-1 px-4 py-2 border border-outline-variant rounded-md text-body-md text-primary hover:bg-primary-fixed hover:border-primary-fixed transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                {t('common.cancel') ?? 'ยกเลิก'}
              </button>
              <button
                type="button"
                onClick={requestConfirm}
                disabled={!selectedId}
                className="flex-1 px-4 py-2 bg-primary text-on-primary rounded-md text-caption uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50"
              >
                {label}
              </button>
            </div>
          </>
        }
      />

      {confirmMessage && (
        <ConfirmModal
          open
          body={confirmMessage}
          okLabel={label}
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