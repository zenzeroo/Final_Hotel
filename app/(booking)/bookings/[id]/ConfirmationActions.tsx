'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { previewCancellation, requestRefundAction, type PreviewCancellationResult } from '@/app/actions/booking'
import { createCheckoutSessionAction } from '@/app/actions/payment'
import { cancelUnpaidBookingAction } from '@/app/actions/booking-unpaid-cancel'
import { useLeaveGuard } from '@/components/booking/LeaveGuardProvider'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'
import { formatTHB } from '@/lib/pricing'
import { formatDate } from '@/lib/dates'

interface ConfirmationActionsProps {
  bookingId: string
  status: string
  paymentStatus: string
  /** Phase 55 — a refund request already exists (one per booking, reject is final). */
  refundRequested?: boolean
}

type PreviewState = PreviewCancellationResult & { open: boolean }

export function ConfirmationActions({
  bookingId,
  status,
  paymentStatus,
  refundRequested = false,
}: ConfirmationActionsProps) {
  const router = useRouter()
  const t = useT()
  const { allowNavigation } = useLeaveGuard()
  const [isPending, startTransition] = useTransition()
  // Phase 17 — inline error state (Phase 14 lesson: silent server-action
  // failures via `void action()` were a UX trap; surface every error).
  const [payError, setPayError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const toast = useToast()
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
      // Leaving to Stripe's hosted checkout is the intentional payment
      // flow, not an accidental navigation away — don't let the leave
      // guard's native "Leave site?" prompt block it.
      allowNavigation()
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
        toast.error(p.error ?? t('customer.bookingDetail.previewFailed'))
        return
      }
      setPreview({ ...p, open: true })
    })
  }

  const handleRefundConfirm = () => {
    // Snapshot the preview data so the post-confirm success modal
    // can render the same full breakdown (booking date + policy +
    // hours + refund + penalty) — the user asked for all of this to
    // be visible after confirming, not just on the preview.
    const snapshot = preview
    setPreview(null)
    startTransition(async () => {
      // Phase 55 — this only SENDS a request; the booking stays valid until
      // a manager approves it (approve cancels, reject keeps the stay).
      const result = await requestRefundAction(bookingId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const refund = Number(result.refundAmount ?? 0)
      const penalty = Number(result.penaltyAmount ?? 0)
      const policy = result.policyName ?? t('bookingDetail.cancellationPolicy')
      const summary =
        snapshot && snapshot.ok
          ? `${t('bookings.refundRequestedSuccess')}\n${t('bookingDetail.bookingCreatedOn')}: ${formatIsoDate(snapshot.bookingCreatedAt ?? '')}\n${t('bookingDetail.cancellationPolicy')}: ${snapshot.policyName ?? '—'}\n${t('bookingDetail.hoursUntilCheckin', { hours: Math.round(snapshot.hoursUntilCheckin ?? 0) })}\n${t('bookingDetail.expectedRefund')}: ${formatTHB(refund)}\n${t('bookingDetail.penalty')}: ${formatTHB(penalty)}`
          : `${t('bookings.refundRequestedSuccess')} (${policy}) — ${t('bookingDetail.expectedRefund')}: ${formatTHB(refund)}`
      setAlertMessage(summary)
      router.refresh()
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

  if (isCheckedOut) {
    return (
      <>
        <div className="mt-6">
          <a
            href="/bookings"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            <MaterialIcon name="rate_review" size={18} />
            {t('bookingDetail.writeReview')}
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
                {t('bookingDetail.payNow')}
              </>
            )}
          </button>
        )}
        {isPaid && refundRequested ? null : (
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
        )}
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
  // Reuse module-level formatter so the post-confirm success modal can
  // surface the booking date too. The preview's local formatDateTime is
  // identical — we hoist it so the handleRefundConfirm closure can
  // reference it after the snapshot is taken.
  const formatBookingDate = formatIsoDate
  const createdAt = preview.bookingCreatedAt ?? ''
  const policyFreeHours = preview.policyFreeHours ?? 0
  const policyRefundPct = preview.policyRefundPct ?? 0
  const hoursUntil = preview.hoursUntilCheckin ?? 0
  const refundAmount = preview.refundAmount ?? 0
  const penaltyAmount = preview.penaltyAmount ?? 0

  return (
    <div className="flex flex-col gap-3 text-left">
      <PreviewRow
        label={t('bookingDetail.bookingCreatedOn')}
        value={formatBookingDate(createdAt)}
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

/**
 * Module-level date formatter. Used by the RefundPreviewBody AND by the
 * handleRefundConfirm closure (after cancelBooking resolves) so both
 * the preview popup and the post-confirm success message show the
 * booking date in the same `วัน/เดือน/ปี` shape the user asked for.
 */
function formatIsoDate(iso: string): string {
  if (!iso) return '—'
  try {
    return formatDate(iso)
  } catch {
    return iso
  }
}