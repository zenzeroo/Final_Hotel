'use client'

import { useState, useTransition } from 'react'
import { previewRefundAction, requestRefundAction, type PreviewRefundResult } from '@/app/actions/booking'
import { AlertModal } from '@/components/ui/AlertModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { useLocale, useT } from '@/lib/i18n/useT'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { formatDate } from '@/lib/dates'
import { formatTHB } from '@/lib/pricing'

export type Eligibility = Extract<PreviewRefundResult, { ok: true }>

/**
 * Phase 57 — guest refund request, shared by /bookings and /bookings/[id].
 *   1. "Are you sure?"
 *   2. check-in date vs today (from preview_refund) — eligible: send the
 *      request; not eligible: explain the rule and close.
 * The rule (full refund ≥ N days before check-in, N from the DB) is applied
 * again by request_refund, so this dialog only informs.
 */
export function RefundRequestDialog({
  bookingId,
  onClose,
  onRequested,
}: {
  bookingId: string
  onClose: () => void
  onRequested: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<'confirm' | 'check'>('confirm')
  const [info, setInfo] = useState<Eligibility | null>(null)

  // ConfirmModal has no disabled state — ignore clicks while a call runs.
  const loadEligibility = () => {
    if (isPending) return
    startTransition(async () => {
      const result = await previewRefundAction(bookingId)
      if (!result.ok) {
        toast.error(result.error)
        onClose()
        return
      }
      setInfo(result)
      setStep('check')
    })
  }

  const submit = () => {
    if (isPending) return
    startTransition(async () => {
      const result = await requestRefundAction(bookingId)
      if (result.error) {
        toast.error(result.error)
        onClose()
        return
      }
      toast.success(t('bookingDetail.refundRequestSent', { amount: formatTHB(result.refundAmount ?? 0, localeBcp) }))
      onRequested()
    })
  }

  if (step === 'confirm') {
    return (
      <ConfirmModal
        open
        body={t('bookingDetail.refundConfirm')}
        okLabel={isPending ? '…' : t('bookingDetail.requestRefund')}
        onCancel={onClose}
        onConfirm={loadEligibility}
      />
    )
  }

  if (!info) return null

  const body = (
    <div className="flex flex-col gap-3 text-left">
      <RefundDateRows info={info} />
      <hr className="border-outline-variant/40 my-1" />
      {info.eligible ? (
        <p className="text-body-md text-primary font-medium">
          {t('bookingDetail.refundEligibleNote', { amount: formatTHB(info.refundAmount, localeBcp) })}
        </p>
      ) : (
        <p className="text-body-md text-error font-medium">
          {t('bookingDetail.refundIneligibleNote', { min: info.minDays })}
        </p>
      )}
    </div>
  )

  if (!info.eligible) {
    return <AlertModal open title={t('bookingDetail.refundCheckTitle')} body={body} onClose={onClose} />
  }

  return (
    <ConfirmModal
      open
      title={t('bookingDetail.refundCheckTitle')}
      body={body}
      okLabel={isPending ? '…' : t('bookingDetail.sendRefundRequest')}
      onCancel={onClose}
      onConfirm={submit}
    />
  )
}

/** Check-in date / today / days until check-in — also used by the staff cancel dialog. */
export function RefundDateRows({ info }: { info: Eligibility }) {
  const t = useT()
  const locale = useLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  return (
    <>
      <Row label={t('bookingDetail.refundCheckInDate')} value={formatDate(info.checkIn, localeBcp)} />
      <Row label={t('bookingDetail.refundToday')} value={formatDate(info.today, localeBcp)} />
      <Row
        label={t('bookingDetail.refundDaysLeft')}
        value={t('bookingDetail.refundDaysValue', { days: Math.max(info.daysUntil, 0) })}
        emphasis
      />
    </>
  )
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-caption text-on-surface-variant">{label}</span>
      <span className={emphasis ? 'text-body-md font-bold text-primary' : 'text-body-md text-on-surface'}>
        {value}
      </span>
    </div>
  )
}
