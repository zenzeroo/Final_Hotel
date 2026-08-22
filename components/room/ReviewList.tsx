import { getApprovedRoomReviews } from '@/lib/data/reviews'
import { ReviewCard } from './ReviewCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface ReviewListProps {
  roomTypeId: string
}

export async function ReviewList({ roomTypeId }: ReviewListProps) {
  const reviews = await getApprovedRoomReviews(roomTypeId)

  if (reviews.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-8 text-center border border-outline-variant">
        <MaterialIcon name="reviews" size={36} className="text-outline-variant mb-3" />
        <p className="text-body-md text-on-surface-variant">
          ยังไม่มีรีวิวสำหรับห้องนี้ เป็นคนแรกที่แบ่งปันประสบการณ์ของคุณ
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
