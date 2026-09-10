import type { PublicReview } from '@/lib/data/types'
import { RatingStars } from './RatingStars'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDate } from '@/lib/dates'

interface ReviewCardProps {
  review: PublicReview
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <article className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant border-l-4 border-l-secondary p-5">
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
            <span className="text-caption text-on-surface-variant">
              {formatDate(review.createdAt)}
            </span>
          </div>
        </div>
      </header>

      {review.title ? (
        <h4 className="text-body-lg font-semibold text-primary mb-2">{review.title}</h4>
      ) : null}

      {review.body ? (
        <blockquote className="text-body-md text-on-surface border-l-2 border-outline-variant pl-3 italic">
          {review.body}
        </blockquote>
      ) : (
        <p className="text-body-md text-on-surface-variant italic inline-flex items-center gap-1">
          <MaterialIcon name="edit_note" size={18} />
          ผู้เข้าพักให้คะแนนโดยไม่เขียนรีวิว
        </p>
      )}
    </article>
  )
}
