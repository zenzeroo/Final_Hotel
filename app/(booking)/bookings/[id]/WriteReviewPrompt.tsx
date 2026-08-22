import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ReviewForm } from '@/components/room/ReviewForm'

interface WriteReviewPromptProps {
  bookingId: string
  roomTypeId: string
  roomTypeName: string
}

/**
 * Inline review prompt shown on the booking detail page when status='checked_out'.
 * Wraps the ReviewForm directly — no separate CTA link, the form is always visible
 * to a guest who has completed a stay.
 */
export function WriteReviewPrompt({
  bookingId,
  roomTypeId,
  roomTypeName,
}: WriteReviewPromptProps) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant p-6">
      <div className="flex items-start gap-3 mb-4">
        <MaterialIcon name="rate_review" size={28} className="text-secondary shrink-0" />
        <div className="flex-1">
          <h2 className="font-display text-xl text-primary mb-1">
            รีวิวการเข้าพักที่ {roomTypeName}
          </h2>
          <p className="text-body-md text-on-surface-variant">
            แบ่งปันประสบการณ์ของคุณเพื่อช่วยผู้เข้าพักท่านอื่น
            รีวิวจะปรากฏหลังจากทีมงานตรวจสอบเรียบร้อย
          </p>
        </div>
      </div>

      <ReviewForm bookingId={bookingId} roomTypeId={roomTypeId} />

      <p className="mt-4 text-caption text-on-surface-variant text-center">
        <Link href="/bookings" className="underline underline-offset-2 hover:text-primary">
          กลับไปหน้าการจอง
        </Link>
      </p>
    </section>
  )
}
