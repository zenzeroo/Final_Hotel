'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  cancelBooking,
  cancelTempBookingAction,
} from '@/app/actions/booking'
import { RefundStatusBadge } from '@/components/booking/RefundStatusBadge'
import { PaymentCountdown } from '@/components/booking/PaymentCountdown'
import { RefundRequestDialog } from '@/components/booking/RefundRequestDialog'
import { ExpiredPaymentButton } from '@/components/booking/ExpiredPaymentButton'
import { roomsSearchHref } from '@/lib/booking-links'
import { createCheckoutSessionAction } from '@/app/actions/payment'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatTHB } from '@/lib/pricing'
import { r2Url } from '@/lib/r2/publicUrl'
import { useT, useLocale } from '@/lib/i18n/useT'
import { formatDate } from '@/lib/dates'
import type { Booking } from '@/lib/data/bookings'
import type { RefundRequestHistoryItem, RefundRequestStatus } from '@/lib/data/types'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { localizedName } from '@/lib/format/roomType'

interface BookingHistoryProps {
  bookings: Booking[]
  refundRequests: RefundRequestHistoryItem[]
}

type Tab = 'active' | 'checkedIn' | 'cancelled' | 'refunds'

function statusLabel(
  status: Booking['status'],
  paymentStatus: Booking['payment_status'],
  lapsedReason: Booking['lapsed_reason'],
  t: ReturnType<typeof useT>,
) {
  // Phase 42 — new statuses before the legacy fallthrough.
  // Phase 52 — added 'awaitingPayment' for confirmed+unpaid rows.
  // Phase 52 follow-up — 'expired' is now shared between two flows;
  // `lapsed_reason` column disambiguates the label.
  if (status === 'expired' && lapsedReason === 'payment_deadline') {
    return t('bookings.statusExpiredPayment')
  }
  if (status === 'expired') return t('bookings.statusExpired')
  if (status === 'temp_pending') return t('bookings.statusTempPending')
  if (status === 'cancelled') return t('bookings.statusCancelled')
  if (status === 'checked_out') return t('bookings.statusCheckedOut')
  if (status === 'checked_in') return t('bookings.statusCheckedIn')
  if (paymentStatus === 'paid') return t('bookings.statusPaid')
  if (paymentStatus === 'refunded') return t('bookings.statusRefunded')
  // Phase 52 — `confirmed + payment_status='unpaid'` reads as
  // "รอชำระเงิน" / "Awaiting payment" (canonical, shared with
  // /bookings/[id]:StatusBadge).
  if (paymentStatus === 'unpaid') return t('bookings.awaitingPayment')
  return t('bookings.statusPending')
}

function statusClass(status: Booking['status'], paymentStatus: Booking['payment_status']) {
  // Phase 42 — distinct classes for temp_pending (amber) + expired (error red).
  // Phase 52 — added 'payment_expired' (error red, same as 'cancelled' / 'expired').
  if (status === 'expired') return 'bg-error/10 text-error'
  if (status === 'payment_expired') return 'bg-error/10 text-error'
  if (status === 'temp_pending') return 'bg-warning/15 text-warning'
  if (status === 'cancelled') return 'bg-error/10 text-error'
  if (status === 'checked_out') return 'bg-surface-container text-on-surface-variant'
  if (paymentStatus === 'paid') return 'bg-primary/10 text-primary'
  return 'bg-secondary/20 text-secondary'
}

/**
 * Phase 50 — TempCountdown removed. The lease is now invisible: the
 * /bookings/new page extends it via heartbeat, and abandoned holds
 * free themselves via the existing lazy-expiry helper. No timer UI.
 */

export function BookingHistory({ bookings, refundRequests }: BookingHistoryProps) {
  const [tab, setTab] = useState<Tab>('active')
  const [refundSub, setRefundSub] = useState<RefundRequestStatus>('pending')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useT()
  const locale = useLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null)
  // Phase 57 — paid bookings go through RefundRequestDialog instead.
  const [refundBookingId, setRefundBookingId] = useState<string | null>(null)
  const [confirmIsTemp, setConfirmIsTemp] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const toast = useToast()
  const [payError, setPayError] = useState<string | null>(null)

  // Phase 42 — Active tab now also includes 'temp_pending' (Phase 42 temporary bookings).
  // 'expired' goes into the Cancelled tab (semantically: no longer in use).
  // Phase 52 — 'payment_expired' (30-min deadline lapsed) also goes to Cancelled.
  const activeBookings = bookings.filter(
    (b) =>
      b.status === 'pending' ||
      b.status === 'confirmed' ||
      b.status === 'temp_pending',
  )
  const checkedInBookings = bookings.filter(
    (b) => b.status === 'checked_in' || b.status === 'checked_out',
  )
  const cancelledBookings = bookings.filter(
    (b) =>
      b.status === 'cancelled' ||
      b.status === 'expired' ||
      b.status === 'payment_expired',
  )

  // Phase 55 — one refund request per booking (a reject is final), so a
  // booking id is enough to know whether the "request refund" button is spent.
  const requestedBookingIds = new Set(refundRequests.map((r) => r.bookingId))
  const refundStatusByBooking = new Map(refundRequests.map((r) => [r.bookingId, r.status]))
  const refundCounts: Record<RefundRequestStatus, number> = { pending: 0, approved: 0, rejected: 0 }
  for (const r of refundRequests) refundCounts[r.status] += 1
  const visibleRefunds = refundRequests.filter((r) => r.status === refundSub)

  const counts = {
    active: activeBookings.length,
    checkedIn: checkedInBookings.length,
    cancelled: cancelledBookings.length,
    refunds: refundRequests.length,
  }

  const visible = (() => {
    switch (tab) {
      case 'active':
        return activeBookings
      case 'checkedIn':
        return checkedInBookings
      case 'cancelled':
        return cancelledBookings
      case 'refunds':
        return []
    }
  })()

  function handleCancel(bookingId: string, isPaid: boolean, isTemp: boolean) {
    if (isPaid) {
      setRefundBookingId(bookingId)
      return
    }
    setConfirmBookingId(bookingId)
    setConfirmIsTemp(isTemp)
  }

  function handlePay(bookingId: string) {
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

  function handleConfirm() {
    const bookingId = confirmBookingId
    setConfirmBookingId(null)
    if (!bookingId) return

    if (confirmIsTemp) {
      // Phase 42 — guest cancels a temp_pending booking before completing the form.
      startTransition(async () => {
        const result = await cancelTempBookingAction(bookingId)
        if (!result.ok || result.error) {
          toast.error(result.error ?? t('customer.bookingDetail.cancelFailed'))
          return
        }
        toast.success(t('bookings.cancelSuccess'))
        router.refresh()
      })
      return
    }

    // Unpaid confirmed booking — nothing to refund, cancel straight away.
    startTransition(async () => {
      const result = await cancelBooking(bookingId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      // Unpaid → nothing was charged, so there is no refund to report.
      toast.success(t('bookingDetail.cancelSuccess'))
      router.refresh()
    })
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant mb-6">
        <TabButton
          label={t('bookings.tabActive')}
          count={counts.active}
          active={tab === 'active'}
          onClick={() => setTab('active')}
        />
        <TabButton
          label={t('bookings.tabCheckedIn')}
          count={counts.checkedIn}
          active={tab === 'checkedIn'}
          onClick={() => setTab('checkedIn')}
        />
        <TabButton
          label={t('bookings.statusCancelled')}
          count={counts.cancelled}
          active={tab === 'cancelled'}
          onClick={() => setTab('cancelled')}
        />
        <TabButton
          label={t('bookings.tabRefunds')}
          count={counts.refunds}
          active={tab === 'refunds'}
          onClick={() => setTab('refunds')}
        />
      </div>

      {payError && (
        <div className="mb-4 px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {payError}
        </div>
      )}

      {tab === 'refunds' ? (
        <RefundHistory
          sub={refundSub}
          onSub={setRefundSub}
          counts={refundCounts}
          items={visibleRefunds}
          t={t}
          localeBcp={localeBcp}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={
            tab === 'active'
              ? 'event'
              : tab === 'checkedIn'
                ? 'history'
                : 'cancel'
          }
          title={
            tab === 'active'
              ? t('bookings.emptyActive')
              : tab === 'checkedIn'
                ? t('bookings.emptyCheckedIn')
                : t('bookings.statusCancelled')
          }
          description={t('bookings.browseRooms')}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              onCancel={handleCancel}
              onPay={handlePay}
              isPending={isPending}
              t={t}
              localeBcp={localeBcp}
              refundRequested={requestedBookingIds.has(b.id)}
              refundStatus={refundStatusByBooking.get(b.id) ?? null}
            />
          ))}
        </div>
      )}

      {confirmBookingId && (
        <ConfirmModal
          open
          body={
            confirmIsTemp ? t('bookingDetail.cancelTempConfirm') : t('bookingDetail.cancelConfirm')
          }
          variant="danger"
          okLabel={t('bookings.cancelBooking')}
          onCancel={() => setConfirmBookingId(null)}
          onConfirm={handleConfirm}
        />
      )}
      {refundBookingId && (
        <RefundRequestDialog
          bookingId={refundBookingId}
          onClose={() => setRefundBookingId(null)}
          onRequested={() => {
            setRefundBookingId(null)
            setTab('refunds')
            setRefundSub('pending')
            router.refresh()
          }}
        />
      )}
      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </>
  )
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-secondary bg-primary text-on-primary font-semibold'
          : 'border-transparent text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
      }`}
    >
      <span className="text-label-md uppercase tracking-wider">{label}</span>
      <span className={`px-2 py-0.5 rounded-full text-caption ${active ? 'bg-primary text-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
        {count}
      </span>
    </button>
  )
}

function BookingRow({
  booking,
  onCancel,
  onPay,
  isPending,
  t,
  localeBcp,
  refundRequested,
  refundStatus,
}: {
  booking: Booking
  onCancel: (id: string, isPaid: boolean, isTemp: boolean) => void
  onPay: (id: string) => void
  isPending: boolean
  t: ReturnType<typeof useT>
  localeBcp: string
  refundRequested: boolean
  refundStatus: RefundRequestStatus | null
}) {
  const isCancelled = booking.status === 'cancelled'
  const isExpired = booking.status === 'expired'
  // Phase 52 — payment_expired = 30-min deadline lapsed. Treat like
  // cancelled/expired in the action row (no Pay button, no Continue).
  const isPaymentExpired = booking.status === 'payment_expired'
  const isCheckedIn = booking.status === 'checked_in'
  const isCheckedOut = booking.status === 'checked_out'
  const isTempPending = booking.status === 'temp_pending'
  const isPaid = booking.payment_status === 'paid'

  return (
    <article className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-hidden">
      <Link
        href={`/bookings/${booking.id}`}
        className="flex flex-col md:flex-row gap-4 p-4 md:p-6 hover:bg-primary-fixed transition-colors"
      >
        {/* Thumbnail */}
        <div className="relative w-full md:w-40 h-40 md:h-28 rounded-xl overflow-hidden bg-surface-container shrink-0">
          {booking.room_type && (
            <Image
              src={r2Url(booking.room_type.hero_image_key)}
              alt={booking.room_type.name}
              fill
              sizes="(max-width: 768px) 100vw, 160px"
              className="object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
            <h3 className="font-display text-lg text-primary truncate">
              {localizedName(booking.room_type, localeBcp.startsWith('en') ? 'en' : 'th') || t('bookings.roomName')}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold ${statusClass(booking.status, booking.payment_status)}`}
              >
                {statusLabel(booking.status, booking.payment_status, booking.lapsed_reason, t)}
              </span>
              {booking.status === 'confirmed' && booking.payment_status === 'unpaid' && booking.payment_due_at && (
                <PaymentCountdown deadlineIso={booking.payment_due_at} variant="chip" />
              )}
            </div>
          </div>
          <p className="text-caption text-on-surface-variant font-mono mb-2">
            {t('bookings.bookingCode')} #{booking.booking_code}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-md text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <MaterialIcon name="event" size={16} />
              {formatDate(booking.check_in, localeBcp)} – {formatDate(booking.check_out, localeBcp)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MaterialIcon name="group" size={16} />
              {t('bookings.guestsCount', { count: booking.guests })}
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="md:text-right shrink-0">
          <p className="text-caption text-on-surface-variant uppercase tracking-wider">{t('bookings.total')}</p>
          <p className="text-xl font-display font-bold text-primary">{formatTHB(booking.total, localeBcp)}</p>
        </div>
      </Link>

      {/* Actions */}
      {!isCancelled && !isExpired && !isPaymentExpired && !isCheckedIn && !isCheckedOut && (
        <div className="flex items-center gap-2 px-4 md:px-6 pb-4 flex-wrap">
          {isTempPending ? (
            // Phase 42 — temp_pending: primary action "ดำเนินการต่อ" + secondary "ยกเลิก"
            <>
              <Link
                href={`/bookings/new?bookingId=${booking.id}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
              >
                <MaterialIcon name="edit" size={16} />
                {t('bookings.continueBooking')}
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  onCancel(booking.id, false, true)
                }}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-label-md uppercase tracking-wider transition-colors disabled:opacity-60 border border-error text-error hover:bg-error hover:text-on-primary"
              >
                <MaterialIcon name="cancel" size={16} />
                {t('bookings.cancelBooking')}
              </button>
            </>
          ) : (
            <>
              {!isPaid && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onPay(booking.id)
                  }}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
                >
                  <MaterialIcon name="credit_card" size={16} />
                  {t('bookings.continuePayment')}
                </button>
              )}
              {isPaid && refundRequested ? (
                // Phase 55 — the one request per booking is spent: show where it stands.
                <span className="text-caption text-on-surface-variant">
                  {refundStatus === 'rejected'
                    ? t('bookings.refundRejectedHint')
                    : t('bookings.refundPendingHint')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onCancel(booking.id, isPaid, false)
                  }}
                  disabled={isPending}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-label-md uppercase tracking-wider transition-colors disabled:opacity-60 ${
                    isPaid
                      ? 'border border-primary text-primary hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed'
                      : 'border border-error text-error hover:bg-error hover:text-on-primary'
                  }`}
                >
                  <MaterialIcon name={isPaid ? 'undo' : 'cancel'} size={16} />
                  {isPaid ? t('bookingDetail.requestRefund') : t('bookings.cancelBooking')}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Phase 58 — payment window ran out: choose another room / try again */}
      {(isExpired || isPaymentExpired) && booking.payment_status === 'unpaid' && (
        <div className="flex items-center gap-2 px-4 md:px-6 pb-4 flex-wrap">
          <ExpiredPaymentButton
            bookingId={booking.id}
            roomsHref={roomsSearchHref(booking)}
            retryable={isExpired && booking.lapsed_reason === 'payment_deadline'}
            variant="inline"
          />
        </div>
      )}
    </article>
  )
}

/**
 * Phase 55 — "ประวัติการขอคืนเงิน" tab body: one sub-filter per stage
 * (waiting / refunded / rejected-but-stay-kept) + a row per request.
 */
function RefundHistory({
  sub,
  onSub,
  counts,
  items,
  t,
  localeBcp,
}: {
  sub: RefundRequestStatus
  onSub: (s: RefundRequestStatus) => void
  counts: Record<RefundRequestStatus, number>
  items: RefundRequestHistoryItem[]
  t: ReturnType<typeof useT>
  localeBcp: string
}) {
  const SUBS: { key: RefundRequestStatus; label: string; empty: string }[] = [
    { key: 'pending', label: t('bookings.refundSubPending'), empty: t('bookings.emptyRefundsPending') },
    { key: 'approved', label: t('bookings.refundSubApproved'), empty: t('bookings.emptyRefundsApproved') },
    { key: 'rejected', label: t('bookings.refundSubRejected'), empty: t('bookings.emptyRefundsRejected') },
  ]
  const current = SUBS.find((s) => s.key === sub) ?? SUBS[0]

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {SUBS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSub(s.key)}
            aria-pressed={sub === s.key}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-label-md transition-colors ${
              sub === s.key
                ? 'bg-primary text-on-primary border-primary font-semibold'
                : 'border-outline-variant text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
            }`}
          >
            {s.label}
            <span className="text-caption opacity-80">{counts[s.key]}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon="payments" title={current.empty} description="" />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((r) => (
            <article
              key={r.id}
              className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-hidden"
            >
              <Link
                href={`/bookings/${r.bookingId}`}
                className="flex flex-col gap-3 p-4 md:p-6 hover:bg-primary-fixed transition-colors"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg text-primary truncate">
                      {localizedName({ name: r.roomName, name_th: r.roomNameTh }, localeBcp.startsWith('en') ? 'en' : 'th') || t('bookings.roomName')}
                    </h3>
                    <p className="text-caption text-on-surface-variant font-mono">
                      {t('bookings.bookingCode')} #{r.bookingCode}
                    </p>
                  </div>
                  <RefundStatusBadge
                    status={r.status}
                    amountFormatted={formatTHB(r.amount, localeBcp)}
                    t={(k) => t(k as Parameters<typeof t>[0])}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-md text-on-surface-variant">
                  <span className="inline-flex items-center gap-1.5">
                    <MaterialIcon name="event" size={16} />
                    {formatDate(r.checkIn, localeBcp)} – {formatDate(r.checkOut, localeBcp)}
                  </span>
                </div>
                <RefundSteps item={r} t={t} localeBcp={localeBcp} />
                {r.status === 'pending' && (
                  <p className="text-body-md text-on-surface-variant">{t('bookings.refundPendingHint')}</p>
                )}
                {r.status === 'approved' && (
                  <p className="text-body-md text-on-surface-variant">{t('bookings.refundApprovedHint')}</p>
                )}
                {r.status === 'rejected' && (
                  <>
                    <p className="text-body-md text-primary font-medium">{t('bookings.refundRejectedHint')}</p>
                    {r.decisionNote && (
                      <p className="text-body-md text-on-surface-variant">
                        {t('bookings.refundManagerNote', { note: r.decisionNote })}
                      </p>
                    )}
                  </>
                )}
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

type StepState = 'done' | 'current' | 'upcoming' | 'approved' | 'rejected'

/**
 * Refund request progress: ส่งคำขอ → Manager พิจารณา → ผลลัพธ์, each with its
 * date. Built only from `createdAt` / `decidedAt` / `status` already on the row.
 */
function RefundSteps({
  item,
  t,
  localeBcp,
}: {
  item: RefundRequestHistoryItem
  t: ReturnType<typeof useT>
  localeBcp: string
}) {
  const decided = item.status !== 'pending'
  const steps: { label: string; date: string | null; state: StepState }[] = [
    { label: t('bookings.refundStepRequested'), date: item.createdAt, state: 'done' },
    {
      label: t('bookings.refundStepReview'),
      date: decided ? item.decidedAt : null,
      state: decided ? 'done' : 'current',
    },
    {
      label:
        item.status === 'approved'
          ? t('bookings.refundSubApproved')
          : item.status === 'rejected'
            ? t('bookings.refundSubRejected')
            : t('bookings.refundStepResult'),
      date: decided ? item.decidedAt : null,
      state: item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'upcoming',
    },
  ]

  const DOT: Record<StepState, { cls: string; icon: string }> = {
    done: { cls: 'bg-primary text-on-primary', icon: 'check' },
    current: { cls: 'bg-secondary text-on-secondary ring-4 ring-secondary/25', icon: 'hourglass_top' },
    upcoming: { cls: 'bg-surface-container text-on-surface-variant', icon: 'more_horiz' },
    approved: { cls: 'bg-primary text-on-primary', icon: 'check_circle' },
    rejected: { cls: 'bg-error text-on-error', icon: 'block' },
  }

  return (
    <ol aria-label={t('bookings.refundStepsLabel')} className="grid grid-cols-3 gap-2">
      {steps.map((s, i) => (
        <li
          key={i}
          aria-current={s.state === 'current' ? 'step' : undefined}
          className="relative flex flex-col items-center text-center gap-1"
        >
          {i > 0 && (
            <span
              aria-hidden
              className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 -z-0 ${
                s.state === 'upcoming' || s.state === 'current' ? 'bg-outline-variant' : 'bg-primary'
              }`}
            />
          )}
          <span className={`relative z-10 inline-flex items-center justify-center w-8 h-8 rounded-full ${DOT[s.state].cls}`}>
            <MaterialIcon name={DOT[s.state].icon} size={18} />
          </span>
          <span
            className={`text-caption font-semibold ${
              s.state === 'rejected' ? 'text-error' : s.state === 'upcoming' ? 'text-on-surface-variant' : 'text-on-surface'
            }`}
          >
            {s.label}
          </span>
          <span className="text-caption text-on-surface-variant">
            {s.date ? formatDate(s.date, localeBcp) : s.state === 'current' ? t('bookings.refundStepWaiting') : '—'}
          </span>
        </li>
      ))}
    </ol>
  )
}
