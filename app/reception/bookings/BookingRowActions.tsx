'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { cancelBookingByStaff } from '@/app/actions/booking'

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
    // Phase 20 #24 — staff path goes through cancelBookingByStaff so the
    // server action can authorise via requireRole + RPC stays atomic.
    // No refund_pct override here (reception cannot override policy);
    // manager override lives in the manager dashboard refund-approval flow.
    if (!confirm('ยกเลิกการจองนี้?')) return
    startTransition(async () => {
      const result = await cancelBookingByStaff(bookingId, null)
      if (result?.error) {
        alert(result.error)
        return
      }
      const refund = Number(result.refundAmount ?? 0)
      const penalty = Number(result.penaltyAmount ?? 0)
      const policy = result.policyName ?? 'นโยบาย'
      const summary =
        refund > 0
          ? `ยกเลิกสำเร็จ (${policy}) — จะคืนเงิน ${refund.toLocaleString('th-TH')} บาท, เสียค่าธรรมเนียม ${penalty.toLocaleString('th-TH')} บาท. ส่งคำขอคืนเงินให้ผู้จัดการแล้ว`
          : 'ยกเลิกสำเร็จ — ไม่มีการคืนเงินตามนโยบาย'
      alert(summary)
      router.refresh()
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
