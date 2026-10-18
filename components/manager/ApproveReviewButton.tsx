'use client'

import { useTransition } from 'react'
import { moderateReviewAction } from '@/app/actions/reviews'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

interface ApproveReviewButtonProps {
  reviewId: string
}

export function ApproveReviewButton({ reviewId }: ApproveReviewButtonProps) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await moderateReviewAction(fd)
        })
      }
    >
      <input type="hidden" name="reviewId" value={reviewId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-primary text-secondary text-caption font-semibold disabled:opacity-50"
      >
        <MaterialIcon name="check" size={16} />
        {pending ? '...' : t('manager.common.approve')}
      </button>
    </form>
  )
}
