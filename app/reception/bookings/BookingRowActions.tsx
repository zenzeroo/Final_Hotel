'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { cancelBooking } from '@/app/actions/booking'

interface BookingRowActionsProps {
  bookingId: string
  status: string
  paymentStatus: string
}

export function BookingRowActions({ bookingId, status, paymentStatus }: BookingRowActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const isCancelled = status === 'cancelled'
  const isCheckedOut = status === 'checked_out'
  const isPaid = paymentStatus === 'paid'

  const handleCancel = () => {
    if (!confirm('ยกเลิกการจองนี้?')) return
    startTransition(async () => {
      const result = await cancelBooking(bookingId)
      if (result?.error) alert(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => router.push(`/bookings/${bookingId}`)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
        aria-label="ดูรายละเอียด"
      >
        <MaterialIcon name="visibility" size={18} />
      </button>
      {!isCancelled && !isCheckedOut && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-error hover:bg-error/10 transition-colors disabled:opacity-50"
          aria-label="ยกเลิก"
        >
          <MaterialIcon name="cancel" size={18} />
        </button>
      )}
      {!isPaid && !isCancelled && (
        <span className="ml-2 inline-flex items-center gap-1 text-caption text-secondary font-semibold uppercase tracking-wider">
          <MaterialIcon name="credit_card" size={14} />
          รอชำระ
        </span>
      )}
    </div>
  )
}
