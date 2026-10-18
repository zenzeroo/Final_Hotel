'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { resolveDamageReportAction } from '@/app/actions/manager'
import { useT } from '@/lib/i18n/useT'

interface ResolveDamageButtonProps {
  reportId: string
  defaultCost: number | null
}

export function ResolveDamageButton({ reportId, defaultCost }: ResolveDamageButtonProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await resolveDamageReportAction(formData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-caption text-primary underline underline-offset-4 hover:bg-primary-fixed"
      >
        {t('manager.damage.charge')}
        <MaterialIcon name="arrow_forward" size={14} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('manager.damage.title')}
        showCloseButton
        body={
          <form action={handleSubmit}>
            <input type="hidden" name="reportId" value={reportId} />

            <label className="block mb-3">
              <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
                {t('manager.damage.cost')}
              </span>
              <input
                type="number"
                name="costEstimate"
                min={0}
                step="1"
                required
                defaultValue={defaultCost ?? 0}
                className="mt-1 w-full rounded-md border border-outline-variant px-3 py-2 bg-surface-container-low text-body-md"
              />
            </label>

            <label className="block mb-3">
              <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
                {t('manager.damage.note')}
              </span>
              <textarea
                name="resolutionNote"
                required
                maxLength={500}
                rows={3}
                placeholder={t('manager.damage.notePlaceholder')}
                className="mt-1 w-full rounded-md border border-outline-variant px-3 py-2 bg-surface-container-low text-body-md"
              />
            </label>

            {error ? (
              <p className="text-caption text-error mb-3" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 rounded-md text-body-md text-on-surface-variant hover:bg-primary-fixed hover:text-primary disabled:opacity-50"
              >
                {t('manager.common.cancel')}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-md bg-primary text-on-primary text-body-md font-semibold disabled:opacity-50"
              >
                {pending ? t('manager.common.saving') : t('manager.damage.confirm')}
              </button>
            </div>
          </form>
        }
      />
    </>
  )
}