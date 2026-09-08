'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cancelBooking, previewCancellation, type PreviewCancellationResult } from '@/app/actions/booking'
import { createCheckoutSessionAction } from '@/app/actions/payment'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'
import { formatTHB } from '@/lib/pricing'

interface ConfirmationActionsProps {
  bookingId: string
  status: string
  paymentStatus: string
}

type PreviewState = PreviewCancellationResult & { open: boolean }

export function ConfirmationActions({ bookingId, status, paymentStatus }: ConfirmationActionsProps) {
  const router = useRouter()
  const t = useT()
  const [isPending, startTransition] = useTransition()
  // Phase 17 — inline error state (Phase 14 lesson: silent server-action
  // failures via `void action()` were a UX trap; surface every error).
  const [payError, setPayError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

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
      window.location.assign(result.data!.url)
    })
  }

  /**
   * Phase 27 — refund preview flow. Two steps so the user sees the
   * policy + expected refund amount BEFORE we commit:
   *   1. previewCancellation() → read-only RPC, returns policy + refund
   *   2. ConfirmModal with rich body → user reviews
   *   3. cancelBooking() → actual mutation (existing RPC, same email +
   *      refund_requests + audit side-effects).
   */
  const handleRefundRequest = () => {
    setPayError(null)
    startTransition(async () => {
      const p = await previewCancellation(bookingId)
      if (!p.ok) {
        setAlertMessage(p.error ?? 'ไม่สามารถดูตัวอย่างการยกเลิกได้')
        return
      }
      setPreview({ ...p, open: true })
    })
  }

  const handleRefundConfirm = () => {
    setPreview(null)
    startTransition(async () => {
      const result = await cancelBooking(bookingId)
      if (result?.error) {
        setAlertMessage(result.error)
        return
      }
      const refund = Number(result.refundAmount ?? 0)
      const penalty = Number(result.penaltyAmount ?? 0)
      const policy = result.policyName ?? t('bookingDetail.cancellationPolicy')
      const summary =
        refund > 0
          ? `${t('bookingDetail.cancelSuccess')} (${policy}) — ${t('bookingDetail.refundAmount')}: ${refund.toLocaleString('th-TH')} ${t('bookingDetail.penalty')}: ${penalty.toLocaleString('th-TH')}`
          : `${t('bookingDetail.cancelSuccess')} — ${t('bookingDetail.refundAmount')}: 0`
      setAlertMessage(summary)
      router.refresh()
    })
  }

  /**
   * Cancel-without-refund (unpaid bookings) keeps the original simple
   * confirm — no preview because there's no refund amount to show.
   */
  const handleCancelUnpaidConfirm = () => {
    setConfirmCancelOpen(false)
    startTransition(async () => {
      const result = await cancelBooking(bookingId)
      if (result?.error) {
        setAlertMessage(result.error)
        return
      }
      setAlertMessage(t('bookingDetail.cancelSuccess'))
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
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
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
                {t('bookingDetail.paymentPending')}
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={isPaid ? handleRefundRequest : () => setConfirmCancelOpen(true)}
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
      </div>

      {/* Phase 27 — refund preview modal (paid bookings only) */}
      {preview?.open && preview.ok && (
        <ConfirmModal
          open
          title={t('bookingDetail.refundPreviewTitle')}
          body={<RefundPreviewBody preview={preview} t={t} />}
          variant="default"
          okLabel={t('bookingDetail.confirmRefund')}
          cancelLabel={t('bookings.cancelBooking') /* fallback — also used as "back" here */}
          onCancel={() => setPreview(null)}
          onConfirm={handleRefundConfirm}
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

/**
 * Rich body for the refund preview modal — booking date, hours until
 * check-in, cancellation policy + window, expected refund amount.
 */
function RefundPreviewBody({
  preview,
  t,
}: {
  preview: PreviewCancellationResult
  t: ReturnType<typeof useT>
}) {
  const createdAt = preview.bookingCreatedAt ?? ''
  const policyFreeHours = preview.policyFreeHours ?? 0
  const policyRefundPct = preview.policyRefundPct ?? 0
  const hoursUntil = preview.hoursUntilCheckin ?? 0
  const refundAmount = preview.refundAmount ?? 0
  const penaltyAmount = preview.penaltyAmount ?? 0

  const formatDateTime = (iso: string) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-3 text-left">
      <PreviewRow
        label={t('bookingDetail.bookingCreatedOn')}
        value={formatDateTime(createdAt)}
      />
      <PreviewRow
        label={t('bookingDetail.hoursUntilCheckin', { hours: Math.round(hoursUntil) })}
      />
      <hr className="border-outline-variant/40 my-1" />
      <PreviewRow
        label={t('bookingDetail.cancellationPolicy')}
        value={preview.policyName ?? '—'}
      />
      {policyRefundPct > 0 ? (
        <PreviewRow
          label={t('bookingDetail.policyWindow', {
            hours: policyFreeHours,
            pct: policyRefundPct,
          })}
        />
      ) : (
        <p className="text-caption text-error">
          {t('bookingDetail.policyWindowExpired', { hours: policyFreeHours })}
        </p>
      )}
      <hr className="border-outline-variant/40 my-1" />
      <PreviewRow
        label={t('bookingDetail.expectedRefund')}
        value={formatTHB(refundAmount)}
        emphasis
      />
      <PreviewRow
        label={t('bookingDetail.penalty')}
        value={formatTHB(penaltyAmount)}
        muted
      />
    </div>
  )
}

function PreviewRow({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string
  value?: string
  emphasis?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-caption text-on-surface-variant">{label}</span>
      {value !== undefined && (
        <span
          className={
            emphasis
              ? 'text-body-md font-bold text-primary'
              : muted
                ? 'text-caption text-on-surface-variant'
                : 'text-body-md text-on-surface'
          }
        >
          {value}
        </span>
      )}
    </div>
  )
}