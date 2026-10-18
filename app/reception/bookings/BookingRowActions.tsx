'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { cancelBookingByStaff } from '@/app/actions/booking'
import { useLocale } from '@/lib/i18n/useT'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { useT } from '@/lib/i18n/useT'

interface BookingRowActionsProps {
  bookingId: string
  status: string
  paymentStatus: string
}

export function BookingRowActions({ bookingId, status, paymentStatus }: BookingRowActionsProps) {
  const t = useT()
  const router = useRouter()
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const toast = useToast()

  const isCancelled = status === 'cancelled'
  const isCheckedOut = status === 'checked_out'
  const isPaid = paymentStatus === 'paid'

  // Phase 20 #24 — staff path goes through cancelBookingByStaff so the
  // server action can authorise via requireRole + RPC stays atomic.
  // No refund_pct override here (reception cannot override policy);
  // manager override lives in the manager dashboard refund-approval flow.
  function handleConfirm() {
    setConfirmMessage(null)
    startTransition(async () => {
      const result = await cancelBookingByStaff(bookingId, null)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      const refund = Number(result.refundAmount ?? 0)
      const penalty = Number(result.penaltyAmount ?? 0)
      const policy = result.policyName ?? t('reception.bookingsPage.policyFallback')
      const summary =
        refund > 0
          ? t('reception.bookingsPage.cancelledWithRefund', {
              policy,
              refund: refund.toLocaleString(LOCALE_BCP47[locale]),
              penalty: penalty.toLocaleString(LOCALE_BCP47[locale]),
            })
          : t('reception.bookingsPage.cancelledNoRefund')
      setAlertMessage(summary)
      router.refresh()
    })
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => router.push(`/reception/bookings/${bookingId}`)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label={t('reception.bookingsPage.viewDetails')}
        >
          <MaterialIcon name="visibility" size={18} />
        </button>
        {!isCancelled && !isCheckedOut && (
          <button
            type="button"
            onClick={() => setConfirmMessage(t('reception.bookingsPage.confirmCancel'))}
            disabled={isPending}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-error hover:bg-error/10 transition-colors disabled:opacity-50"
            aria-label={t('reception.bookingsPage.cancel')}
          >
            <MaterialIcon name="cancel" size={18} />
          </button>
        )}
        {!isPaid && !isCancelled && (
          <span className="ml-2 inline-flex items-center gap-1 text-caption text-secondary font-semibold uppercase tracking-wider">
            <MaterialIcon name="credit_card" size={14} />
            {t('reception.bookingsPage.filterUnpaid')}
          </span>
        )}
      </div>
      {confirmMessage && (
        <ConfirmModal
          open
          body={confirmMessage}
          variant="danger"
          okLabel={t('reception.bookingsPage.cancelBooking')}
          onCancel={() => setConfirmMessage(null)}
          onConfirm={handleConfirm}
        />
      )}
      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </>
  )
}
