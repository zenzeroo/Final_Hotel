'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { deleteReviewAction } from '@/app/actions/reviews'
import { useT } from '@/lib/i18n/useT'

interface DeleteReviewButtonProps {
  reviewId: string
  guestName: string
}

export function DeleteReviewButton({ reviewId, guestName }: DeleteReviewButtonProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await deleteReviewAction(formData)
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
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-caption text-error hover:bg-error-container transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error disabled:opacity-50"
      >
        <MaterialIcon name="delete" size={14} />
        {t('manager.reviewsPage.deleteForever')}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('manager.reviewsPage.deleteTitle')}
        showCloseButton
        body={
          <form action={handleSubmit}>
            <p className="text-body-md text-on-surface-variant mb-4">
              {t('manager.reviewsPage.deleteBody', { name: guestName })}
            </p>
            <input type="hidden" name="reviewId" value={reviewId} />

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
                className="px-4 py-2 rounded-md text-body-md text-on-surface-variant hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50"
              >
                {t('manager.common.cancel')}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-md bg-error text-on-error text-body-md font-semibold disabled:opacity-50"
              >
                {pending ? t('manager.reviewsPage.deleting') : t('manager.reviewsPage.deleteForever')}
              </button>
            </div>
          </form>
        }
      />
    </>
  )
}