import { getApprovedRoomReviews } from '@/lib/data/reviews'
import { ReviewCard } from './ReviewCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

interface ReviewListProps {
  roomTypeId: string
}

export async function ReviewList({ roomTypeId }: ReviewListProps) {
  const [reviews, locale] = await Promise.all([getApprovedRoomReviews(roomTypeId), getLocale()])
  const t = getT(locale)

  if (reviews.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-8 text-center border border-outline-variant">
        <MaterialIcon name="reviews" size={36} className="text-outline-variant mb-3" />
        <p className="text-body-md text-on-surface-variant">
          {t('customer.review.noReviews')}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </div>
  )
}
