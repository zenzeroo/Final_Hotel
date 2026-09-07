'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cancelBooking } from '@/app/actions/booking'
import { createCheckoutSessionAction } from '@/app/actions/payment'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'

interface ConfirmationActionsProps {
  bookingId: string
  status: string
  paymentStatus: string
}

export function ConfirmationActions({ bookingId, status, paymentStatus }: ConfirmationActionsProps) {
  const router = useRouter()
  const t = useT()
  const [isPending, startTransition] = useTransition()
  // Phase 17 — inline error state (Phase 14 lesson: silent server-action
  // failures via `void action()` were a UX trap; surface every error).
  const [payError, setPayError] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const isCancelled = status === 'cancelled'
  const isCheckedOut = status === 'checked_out'
  const isPaid = paymentStatus === 'paid'

  const handlePay = () => {
    setPayError(null)
    startTransition(async () => {
      const result = await createCheckoutSessionAction({ bookingId })
      if (!result.ok) {
        setPayError(result.error)
        return
      }
      // Full-page redirect to Stripe-hosted Checkout. Using
      // window.location.assign (not router.push) because Stripe's page is
      // on a different origin — Next.js client routing can't help here.
      window.location.assign(result.data!.url)
    })
  }

  function handleConfirm() {
    setConfirmMessage(null)
    startTransition(async () => {
      const result = await cancelBooking(bookingId)
      if (result?.error) {
        setAlertMessage(result.error)
        return
      }
      // Phase 20 #24 — surface the policy result so the guest sees what
      // they will receive back vs forfeit, per their linked policy.
      const refund = Number(result.refundAmount ?? 0)
      const penalty = Number(result.penaltyAmount ?? 0)
      const policy = result.policyName ?? 'นโยบาย'
      const summary =
        refund > 0
          ? `ยกเลิกการจองสำเร็จ\nตามเงื่อนไข "${policy}": จะได้รับคืน ${refund.toLocaleString('th-TH')} บาท (เสียค่าธรรมเนียม ${penalty.toLocaleString('th-TH')} บาท)\nคำขอคืนเงินถูกส่งให้ผู้จัดการพิจารณาแล้ว`
          : penalty > 0
            ? `ยกเลิกการจองสำเร็จ\nตามเงื่อนไข "${policy}": ไม่สามารถขอคืนเงินได้ (เสียค่าธรรมเนียม ${penalty.toLocaleString('th-TH')} บาท)`
            : 'ยกเลิกการจองสำเร็จ'
      setAlertMessage(summary)
      router.refresh()
    })
  }

  if (isCancelled) {
    return (
      <>
        <div className="mt-6 px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-center">
          <p className="text-body-md text-error font-medium">การจองนี้ถูกยกเลิกแล้ว</p>
        </div>
        {alertMessage && (
          <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
        )}
      </>
    )
  }

  if (isCheckedOut) {
    return (
      <>
        <div className="mt-6">
          <a
            href="/bookings"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
          >
            <MaterialIcon name="rate_review" size={18} />
            เขียนรีวิว
          </a>
        </div>
        {alertMessage && (
          <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
        )}
      </>
    )
  }

  const cancelConfirmMessage = isPaid
    ? t('bookingDetail.refundConfirm')
    : t('bookingDetail.cancelConfirm')

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
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                กำลังเปิดหน้าชำระเงิน…
              </>
            ) : (
              <>
                <MaterialIcon name="credit_card" size={18} />
                ชำระเงินผ่าน Stripe
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmMessage(cancelConfirmMessage)}
          disabled={isPending}
          className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-label-md uppercase tracking-wider transition-colors disabled:opacity-60 ${
            isPaid
              ? 'border border-primary text-primary hover:bg-primary hover:text-secondary'
              : 'border border-error text-error hover:bg-error hover:text-on-primary'
          }`}
        >
          <MaterialIcon name={isPaid ? 'undo' : 'cancel'} size={18} />
          {isPaid ? t('bookingDetail.requestRefund') : t('bookingDetail.cancelBooking')}
        </button>
      </div>
      {confirmMessage && (
        <ConfirmModal
          open
          body={confirmMessage}
          variant={isPaid ? 'default' : 'danger'}
          okLabel={isPaid ? t('bookingDetail.requestRefund') : t('bookings.cancelBooking')}
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