'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { deleteReviewAction } from '@/app/actions/reviews'

interface DeleteReviewButtonProps {
  reviewId: string
  guestName: string
}

export function DeleteReviewButton({ reviewId, guestName }: DeleteReviewButtonProps) {
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
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-caption text-error hover:bg-error-container disabled:opacity-50"
      >
        <MaterialIcon name="delete" size={14} />
        ลบถาวร
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            action={handleSubmit}
            className="w-full max-w-md bg-surface-container-lowest rounded-lg shadow-level-2 p-6"
          >
            <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
              ลบรีวิวนี้ถาวร?
            </h3>
            <p className="text-body-md text-on-surface-variant mb-4">
              รีวิวจาก <span className="font-semibold">{guestName}</span>{' '}
              จะถูกลบออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้
              การดำเนินการนี้มีไว้สำหรับผู้ดูแลระบบเท่านั้น
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
                className="px-4 py-2 rounded-md text-body-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-md bg-error text-on-error text-body-md font-semibold disabled:opacity-50"
              >
                {pending ? 'กำลังลบ...' : 'ลบถาวร'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
