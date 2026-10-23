'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createCheckoutSessionAction } from '@/app/actions/payment'
import { cancelUnpaidBookingAction } from '@/app/actions/booking-unpaid-cancel'
import { useLeaveGuard } from '@/components/booking/LeaveGuardProvider'
import { RefundRequestDialog } from '@/components/booking/RefundRequestDialog'
import { ExpiredPaymentButton } from '@/components/booking/ExpiredPaymentButton'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'

interface ConfirmationActionsProps {
  bookingId: string
  status: string
  paymentStatus: string
  /** Phase 55 — a refund request already exists (one per booking, reject is final). */
  refundRequested?: boolean
  /** Phase 58 — 'payment_deadline' expiries can be re-opened ("ทำรายการนี้อีกครั้ง"). */
  lapsedReason?: string | null
  /** Phase 58 — room list with this booking's dates ("เลือกห้องพักอื่น"). */
  roomsHref?: string
}

export function ConfirmationActions({
  bookingId,
  status,
  paymentStatus,
  refundRequested = false,
  lapsedReason = null,
  roomsHref = '/rooms',
}: ConfirmationActionsProps) {
  const router = useRouter()
  const t = useT()
  const { allowNavigation } = useLeaveGuard()
  const [isPending, startTransition] = useTransition()
  // Phase 17 — inline error state (Phase 14 lesson: silent server-action
  // failures via `void action()` were a UX trap; surface every error).
  const [payError, setPayError] = useState<string | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const toast = useToast()
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  const isCancelled = status === 'cancelled'
  const isCheckedOut = status === 'checked_out'
  const isPaid = paymentStatus === 'paid'
  // Phase 58 — payment window ran out: no Pay / Cancel, only the expired button.
  const isPaymentLapsed =
    (status === 'expired' || status === 'payment_expired') && paymentStatus === 'unpaid'

  const handlePay = () => {
    setPayError(null)
    startTransition(async () => {
      const result = await createCheckoutSessionAction({ bookingId })
      if (!result.ok) {
        setPayError(result.error)
        return
      }
      // Leaving to Stripe's hosted checkout is the intentional payment
      // flow, not an accidental navigation away — don't let the leave
      // guard's native "Leave site?" prompt block it.
      allowNavigation()
      window.location.assign(result.data!.url)
    })
  }

  /**
   * Cancel-without-refund (unpaid bookings) keeps the original simple
   * confirm — no preview because there's no refund amount to show.
   *
   * Phase 52 follow-up — routes through `cancelUnpaidBookingAction`
   * (not `cancelBooking`) so the open Stripe Checkout Session is
   * also expired and the customer can't later pay for a booking we
   * just cancelled. After success we redirect to `/bookings` (matches
   * the leave-guard's behavior on /bookings/[id]). If the server
   * reconciled the booking as paid (Stripe race), we stay on the
   * page so the user can see the paid state.
   */
  const handleCancelUnpaidConfirm = () => {
    setConfirmCancelOpen(false)
    startTransition(async () => {
      const result = await cancelUnpaidBookingAction({ bookingId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.data?.status === 'paid') {
        // Race reconciled as paid — refresh in place to show the paid
        // state instead of redirecting to the cancelled row in history.
        toast.success(t('bookingDetail.cancelSuccess'))
        router.refresh()
        return
      }
      toast.success(t('bookingDetail.cancelSuccess'))
      router.push('/bookings')
    })
  }

  if (isCancelled) {
    return (
      <>
        <div className="mt-6 px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-center">
          <p className="text-body-md text-error font-medium">{t('customer.bookingDetail.cancelled')}</p>
        </div>
        {alertMessage && (
          <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
        )}
      </>
    )
  }

  if (isPaymentLapsed) {
    return (
      <div className="mt-6">
        <ExpiredPaymentButton
          bookingId={bookingId}
          roomsHref={roomsHref}
          retryable={status === 'expired' && lapsedReason === 'payment_deadline'}
        />
      </div>
    )
  }

  if (isCheckedOut) {
    return (
      <>
        <div className="mt-6">
          <Link
            href="/bookings"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            <MaterialIcon name="rate_review" size={18} />
            {t('bookingDetail.writeReview')}
          </Link>
        </div>
        {alertMessage && (
          <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
        )}
      </>
    )
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3">
        {payError && (
          <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
            {payError}
          </div>
        )}
        {!isPaid && (
          <button
            type="button"
            onClick={handlePay}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                {t('bookingDetail.paymentPending')}…
              </>
            ) : (
              <>
                <MaterialIcon name="credit_card" size={18} />
                {t('bookingDetail.payNow')}
              </>
            )}
          </button>
        )}
        {isPaid && refundRequested ? null : (
        <button
          type="button"
          onClick={isPaid ? () => setRefundOpen(true) : () => setConfirmCancelOpen(true)}
          disabled={isPending}
          className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-label-md uppercase tracking-wider transition-colors disabled:opacity-60 ${
            isPaid
              ? 'border border-primary text-primary hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed'
              : 'border border-error text-error hover:bg-error hover:text-on-primary'
          }`}
        >
          <MaterialIcon name={isPaid ? 'undo' : 'cancel'} size={18} />
          {isPaid ? t('bookingDetail.requestRefund') : t('bookingDetail.cancelBooking')}
        </button>
        )}
      </div>

      {/* Phase 57 — refund request: "sure?" → check-in vs today → send */}
      {refundOpen && (
        <RefundRequestDialog
          bookingId={bookingId}
          onClose={() => setRefundOpen(false)}
          onRequested={() => {
            setRefundOpen(false)
            router.refresh()
          }}
        />
      )}

      {/* Simple confirm modal (unpaid bookings) */}
      {confirmCancelOpen && (
        <ConfirmModal
          open
          body={t('bookingDetail.cancelConfirm')}
          variant="danger"
          okLabel={t('bookings.cancelBooking')}
          onCancel={() => setConfirmCancelOpen(false)}
          onConfirm={handleCancelUnpaidConfirm}
        />
      )}

      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </>
  )
}
