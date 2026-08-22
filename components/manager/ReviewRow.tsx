import { format } from 'date-fns'
import type { ReviewForModeration } from '@/lib/data/types'
import { RatingStars } from '@/components/room/RatingStars'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ApproveReviewButton } from './ApproveReviewButton'
import { HideReviewButton } from './HideReviewButton'
import { UnhideReviewButton } from './UnhideReviewButton'
import { DeleteReviewButton } from './DeleteReviewButton'

interface ReviewRowProps {
  review: ReviewForModeration
  /** Which tab is being shown — drives which action buttons render */
  tab: 'pending' | 'approved' | 'hidden'
  /** Only admins see the delete button */
  isAdmin: boolean
}

const STATUS_LABEL = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  hidden: 'ซ่อนไว้',
} as const

const STATUS_CLASS = {
  pending: 'bg-secondary-container text-on-secondary-container',
  approved: 'bg-primary-container text-on-primary-container',
  hidden: 'bg-surface-variant text-on-surface-variant',
} as const

export function ReviewRow({ review, tab, isAdmin }: ReviewRowProps) {
  return (
    <article className="bg-surface-container-lowest rounded-2xl shadow-level-1 border border-outline-variant p-5 flex flex-col gap-4">
      {/* Header */}
      <header className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${review.avatarBgClass}`}
          aria-hidden="true"
        >
          {review.guestInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-body-md font-semibold text-on-surface truncate">
              {review.guestName}
            </p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption ${STATUS_CLASS[review.status]}`}
            >
              {STATUS_LABEL[review.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <RatingStars value={review.rating} size={14} showValue={false} />
            <span className="text-caption text-on-surface-variant">
              {format(new Date(review.createdAt), 'd MMM yyyy')}
            </span>
            <span className="text-caption text-on-surface-variant inline-flex items-center gap-1">
              <MaterialIcon name="hotel" size={12} />
              {review.roomTypeName}
            </span>
            {review.bookingCode ? (
              <span className="text-caption text-on-surface-variant inline-flex items-center gap-1">
                <MaterialIcon name="tag" size={12} />
                #{review.bookingCode}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Body */}
      {review.title ? (
        <h4 className="text-body-lg font-semibold text-primary">{review.title}</h4>
      ) : null}
      {review.body ? (
        <blockquote className="text-body-md text-on-surface border-l-2 border-outline-variant pl-3 italic">
          {review.body}
        </blockquote>
      ) : (
        <p className="text-body-md text-on-surface-variant italic">— ไม่มีคำอธิบาย —</p>
      )}

      {/* Audit trail */}
      {review.moderatedBy || review.moderatedAt ? (
        <p className="text-caption text-on-surface-variant border-t border-outline-variant pt-3">
          ดำเนินการโดย {review.moderatedBy ?? '—'}{' '}
          {review.moderatedAt
            ? `เมื่อ ${format(new Date(review.moderatedAt), 'd MMM yyyy HH:mm')}`
            : ''}
        </p>
      ) : null}

      {/* Action buttons — based on current tab */}
      <footer className="flex items-center gap-2 flex-wrap">
        {tab === 'pending' ? (
          <>
            <ApproveReviewButton reviewId={review.id} />
            <HideReviewButton reviewId={review.id} withReason={false} />
            {isAdmin ? (
              <DeleteReviewButton reviewId={review.id} guestName={review.guestName} />
            ) : null}
          </>
        ) : null}

        {tab === 'approved' ? (
          <>
            <HideReviewButton reviewId={review.id} />
            {isAdmin ? (
              <DeleteReviewButton reviewId={review.id} guestName={review.guestName} />
            ) : null}
          </>
        ) : null}

        {tab === 'hidden' ? (
          <UnhideReviewButton reviewId={review.id} />
        ) : null}
      </footer>
    </article>
  )
}
