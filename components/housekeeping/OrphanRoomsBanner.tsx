'use client'

/**
 * Phase 54 — warns about dirty rooms that have no open housekeeping task
 * (auto-allocation can't see them) and creates the missing cleaning tasks.
 */
import { useState, useTransition } from 'react'
import { createTasksForOrphanRoomsAction } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'

interface OrphanRoomsBannerProps {
  rooms: { id: string; unitLabel: string }[]
}

export function OrphanRoomsBanner({ rooms }: OrphanRoomsBannerProps) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const toast = useToast()

  if (rooms.length === 0) return null

  function handleConfirm() {
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await createTasksForOrphanRoomsAction()
      if (result.ok) toast.success(t('manager.housekeepingPage.orphanTasksCreated', { count: result.data?.created ?? 0 }))
      else toast.error(result.error)
    })
  }

  return (
    <>
      {rooms.length > 0 && (
        <section
          role="status"
          className="mb-8 flex items-start gap-4 flex-wrap rounded-lg border border-error/40 bg-error-container/40 p-4"
        >
          <MaterialIcon name="warning" size={24} className="text-error shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body-md font-semibold text-on-error-container">
              {t('manager.housekeepingPage.orphanTitle', { count: rooms.length })}
            </p>
            <p className="text-caption text-on-surface-variant mt-1">
              {t('manager.housekeepingPage.orphanBody', {
                rooms: rooms.map((r) => r.unitLabel).join(', '),
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-error text-on-error rounded-md text-caption uppercase tracking-wider hover:opacity-90 transition-opacity duration-200 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
          >
            <MaterialIcon name="add_task" size={16} />
            {t('manager.housekeepingPage.createOrphanTasks')}
          </button>
        </section>
      )}

      {confirmOpen && (
        <ConfirmModal
          open
          body={t('manager.housekeepingPage.confirmCreateOrphanTasks', { count: rooms.length })}
          okLabel={t('manager.housekeepingPage.createOrphanTasks')}
          cancelLabel={t('manager.housekeepingPage.cancel')}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
