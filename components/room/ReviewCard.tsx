'use client'

import type { PublicReview } from '@/lib/data/types'
import { useT } from '@/lib/i18n/useT'
import { RatingStars } from './RatingStars'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDate } from '@/lib/dates'

interface ReviewCardProps {
  review: PublicReview
}

export function ReviewCard({ review }: ReviewCardProps) {
  const t = useT()
  return (
    <article className="bg-surface-container-low p-6">
      <header className="flex items-start gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${review.avatarBgClass}`}
          aria-hidden="true"
        >
          {review.guestInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-md font-semibold text-on-surface truncate">
            {review.guestName}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <RatingStars value={review.rating} size={14} showValue={false} />
            <span className="text-[14px] text-on-surface-variant">
              {formatDate(review.createdAt)}
            </span>
          </div>
        </div>
      </header>

      {review.title ? (
        <h4 className="text-body-lg font-semibold text-primary mb-2">{review.title}</h4>
      ) : null}

      {review.body ? (
        <blockquote className="text-body-md text-on-surface">
          {review.body}
        </blockquote>
      ) : (
        <p className="text-body-md text-on-surface-variant italic inline-flex items-center gap-1">
          <MaterialIcon name="edit_note" size={18} />
          {t('customer.review.ratedNoText')}
        </p>
      )}
    </article>
  )
}
