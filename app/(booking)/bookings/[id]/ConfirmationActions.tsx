'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { markPaid, cancelBooking } from '@/app/actions/booking'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface ConfirmationActionsProps {
  bookingId: string
  status: string
  paymentStatus: string
}

export function ConfirmationActions({ bookingId, status, paymentStatus }: ConfirmationActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const isCancelled = status === 'cancelled'
  const isCheckedOut = status === 'checked_out'
  const isPaid = paymentStatus === 'paid'

  const handleMarkPaid = () => {
    startTransition(async () => {
      const result = await markPaid(bookingId)
      if (result?.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const handleCancel = () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?')) return
    startTransition(async () => {
      const result = await cancelBooking(bookingId)
      if (result?.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  if (isCancelled) {
    return (
      <div className="mt-6 px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-center">
        <p className="text-body-md text-error font-medium">การจองนี้ถูกยกเลิกแล้ว</p>
      </div>
    )
  }

  if (isCheckedOut) {
    return (
      <div className="mt-6">
        <a
          href="/bookings"
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
        >
          <MaterialIcon name="rate_review" size={18} />
          เขียนรีวิว
        </a>
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {!isPaid && (
        <button
          type="button"
          onClick={handleMarkPaid}
          disabled={isPending}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              กำลังดำเนินการ…
            </>
          ) : (
            <>
              <MaterialIcon name="credit_card" size={18} />
              ยืนยันการจ่ายเงิน (ทดสอบ)
            </>
          )}
        </button>
      )}
      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 border border-error text-error rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-error hover:text-on-primary transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="cancel" size={18} />
        ยกเลิกการจอง
      </button>
    </div>
  )
}
