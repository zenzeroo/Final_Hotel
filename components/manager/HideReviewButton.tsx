'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { hideReviewAction } from '@/app/actions/reviews'

interface HideReviewButtonProps {
  reviewId: string
  /** When true, renders as "Unhide" and calls unhideReviewAction */
  unhidden?: boolean
  /** When unhidden=false (hide), show a confirm modal with optional reason */
  withReason?: boolean
}

export function HideReviewButton({
  reviewId,
  unhidden = false,
  withReason = false,
}: HideReviewButtonProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await hideReviewAction(formData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  if (unhidden) {
    // Approved-tab hide button → simple inline form, no modal
    return (
      <form
        action={(fd) =>
          startTransition(async () => {
            await hideReviewAction(fd)
          })
        }
      >
        <input type="hidden" name="reviewId" value={reviewId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-outline-variant text-caption font-semibold text-on-surface-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50"
        >
          <MaterialIcon name="visibility_off" size={14} />
          {pending ? '...' : 'ซ่อน'}
        </button>
      </form>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-outline-variant text-caption font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <MaterialIcon name="visibility_off" size={14} />
        ซ่อน
      </button>

      {withReason ? (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="ซ่อนรีวิวนี้"
          showCloseButton
          body={
            <form action={handleSubmit}>
              <input type="hidden" name="reviewId" value={reviewId} />
              <p className="text-body-md text-on-surface-variant mb-4">
                รีวิวจะถูกซ่อนจากหน้าห้องพักแต่ยังคงอยู่ในคิวสำหรับตรวจสอบ
                สามารถกู้คืนได้ภายหลัง
              </p>

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
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 rounded-md bg-error text-on-error text-body-md font-semibold disabled:opacity-50"
                >
                  {pending ? 'กำลังซ่อน...' : 'ยืนยันการซ่อน'}
                </button>
              </div>
            </form>
          }
        />
      ) : (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="ซ่อนรีวิวนี้?"
          showCloseButton
          body={
            <form action={handleSubmit}>
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
                  className="px-4 py-2 rounded-md text-body-md text-on-surface-variant hover:bg-primary-fixed hover:text-primary disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 rounded-md bg-error text-on-error text-body-md font-semibold disabled:opacity-50"
                >
                  {pending ? '...' : 'ยืนยัน'}
                </button>
              </div>
            </form>
          }
        />
      )}
    </>
  )
}