'use client'

import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { unhideReviewAction } from '@/app/actions/reviews'

interface UnhideReviewButtonProps {
  reviewId: string
}

export function UnhideReviewButton({ reviewId }: UnhideReviewButtonProps) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await unhideReviewAction(fd)
        })
      }
    >
      <input type="hidden" name="reviewId" value={reviewId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-primary text-secondary text-caption font-semibold disabled:opacity-50"
      >
        <MaterialIcon name="visibility" size={14} />
        {pending ? '...' : 'กู้คืน (อนุมัติ)'}
      </button>
    </form>
  )
}
