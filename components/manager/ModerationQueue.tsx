import type { ReviewForModeration } from '@/lib/data/types'
import { ReviewRow } from './ReviewRow'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface ModerationQueueProps {
  reviews: ReviewForModeration[]
  tab: 'pending' | 'approved' | 'hidden'
  isAdmin: boolean
  emptyMessage: string
}

export function ModerationQueue({
  reviews,
  tab,
  isAdmin,
  emptyMessage,
}: ModerationQueueProps) {
  if (reviews.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-10 text-center">
        <MaterialIcon name="reviews" size={36} className="text-outline-variant mb-3" />
        <p className="text-body-md text-on-surface-variant">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {reviews.map((r) => (
        <ReviewRow key={r.id} review={r} tab={tab} isAdmin={isAdmin} />
      ))}
    </div>
  )
}
