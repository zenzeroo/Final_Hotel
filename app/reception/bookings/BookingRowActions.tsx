'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RefundDateRows, type Eligibility } from '@/components/booking/RefundRequestDialog'
import { cancelBookingByStaff, previewRefundAction } from '@/app/actions/booking'
import { useLocale, useT } from '@/lib/i18n/useT'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { formatTHB } from '@/lib/pricing'

interface BookingRowActionsProps {
  bookingId: string
  status: string
  paymentStatus: string
}

/** Cancel (with the refund preview) — used only on /reception/check-in-out/[id]. */
export function BookingRowActions({ bookingId, status, paymentStatus }: BookingRowActionsProps) {
  const t = useT()
  const router = useRouter()
  const locale = useLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const [isPending, startTransition] = useTransition()
  // Phase 57b — the confirm dialog shows check-in vs today + the refund
  // outcome under the 2-day rule (same preview_refund the guest sees).
  const [preview, setPreview] = useState<Eligibility | null>(null)
  const toast = useToast()

  const isCancelled = status === 'cancelled'
  const isCheckedOut = status === 'checked_out'
  const isPaid = paymentStatus === 'paid'

  function openCancel() {
    if (isPending) return
    startTransition(async () => {
      const result = await previewRefundAction(bookingId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setPreview(result)
    })
  }

  // Staff path goes through cancelBookingByStaff (requireRole + atomic RPC).
  // No refund_pct override here — reception cannot override the rule.
  function handleConfirm() {
    if (isPending) return
    setPreview(null)
    startTransition(async () => {
      const result = await cancelBookingByStaff(bookingId, null)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      const refund = Number(result.refundAmount ?? 0)
      toast.success(
        refund > 0
          ? t('reception.bookingsPage.cancelledRefundRequested', { amount: formatTHB(refund, localeBcp) })
          : t('reception.bookingsPage.cancelledNoRefund'),
      )
      router.refresh()
    })
  }

  const outcome = !preview
    ? ''
    : !isPaid
      ? t('reception.bookingsPage.cancelOutcomeUnpaid')
      : preview.eligible
        ? t('reception.bookingsPage.cancelOutcomeRefund', { amount: formatTHB(preview.refundAmount, localeBcp) })
        : t('reception.bookingsPage.cancelOutcomeTooLate', { min: preview.minDays })

  return (
    <>
      <div className="inline-flex items-center gap-1">
        {!isCancelled && !isCheckedOut && (
          <button
            type="button"
            onClick={openCancel}
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
      {preview && (
        <ConfirmModal
          open
          title={t('reception.bookingsPage.confirmCancel')}
          body={
            <div className="flex flex-col gap-3 text-left">
              <RefundDateRows info={preview} />
              <hr className="border-outline-variant/40 my-1" />
              <p
                className={`text-body-md font-medium ${
                  !isPaid ? 'text-on-surface-variant' : preview.eligible ? 'text-primary' : 'text-error'
                }`}
              >
                {outcome}
              </p>
            </div>
          }
          variant="danger"
          okLabel={t('reception.bookingsPage.cancelBooking')}
          onCancel={() => setPreview(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
