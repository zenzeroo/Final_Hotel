'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { confirmMaintenanceRoomClosure } from '@/app/actions/maintenance'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

export function ConfirmMaintenanceButton({ reportId }: { reportId: string }) {
  const t = useT()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    const id = formData.get('reportId') as string
    startTransition(async () => {
      const result = await confirmMaintenanceRoomClosure(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setIsOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-error text-on-error text-caption font-semibold hover:opacity-90 transition-opacity"
      >
        <MaterialIcon name="lock" size={16} />
        {t('manager.maintenancePage.confirmClosure')}
      </button>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={t('manager.maintenancePage.confirmDialogTitle')}
        body={
          <form action={handleSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="reportId" value={reportId} />
            <p className="text-body-md text-on-surface">
              {t('manager.maintenancePage.confirmBody')}
            </p>
            {error && <p className="text-body-md text-error">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-md text-body-md text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
              >
                {t('manager.common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-error text-on-error text-body-md font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? t('manager.maintenancePage.confirming') : t('manager.maintenancePage.confirmClosure')}
              </button>
            </div>
          </form>
        }
      />
    </>
  )
}
