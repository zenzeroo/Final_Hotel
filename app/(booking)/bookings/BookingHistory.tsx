'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { cancelBooking } from '@/app/actions/booking'
import { createCheckoutSessionAction } from '@/app/actions/payment'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatTHB } from '@/lib/pricing'
import { r2Url } from '@/lib/r2/publicUrl'
import { useT, useLocale } from '@/lib/i18n/useT'
import type { Booking } from '@/lib/data/bookings'
import { LOCALE_BCP47 } from '@/lib/i18n/config'

interface BookingHistoryProps {
  bookings: Booking[]
}

type Tab = 'active' | 'checkedIn' | 'cancelled'

function formatDate(iso: string, localeBcp: string) {
  return new Intl.DateTimeFormat(localeBcp, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function statusLabel(
  status: Booking['status'],
  paymentStatus: Booking['payment_status'],
  t: ReturnType<typeof useT>,
) {
  if (status === 'cancelled') return t('bookings.statusCancelled')
  if (status === 'checked_out') return t('bookings.statusCheckedOut')
  if (status === 'checked_in') return t('bookings.statusCheckedIn')
  if (paymentStatus === 'paid') return t('bookings.statusPaid')
  if (paymentStatus === 'refunded') return t('bookings.statusRefunded')
  return t('bookings.statusPending')
}

function statusClass(status: Booking['status'], paymentStatus: Booking['payment_status']) {
  if (status === 'cancelled') return 'bg-error/10 text-error'
  if (status === 'checked_out') return 'bg-surface-container text-on-surface-variant'
  if (paymentStatus === 'paid') return 'bg-primary/10 text-primary'
  return 'bg-secondary/20 text-secondary'
}

export function BookingHistory({ bookings }: BookingHistoryProps) {
  const [tab, setTab] = useState<Tab>('active')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useT()
  const locale = useLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null)
  const [confirmIsRefund, setConfirmIsRefund] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  const activeBookings = bookings.filter(
    (b) => b.status === 'pending' || b.status === 'confirmed',
  )
  const checkedInBookings = bookings.filter(
    (b) => b.status === 'checked_in' || b.status === 'checked_out',
  )
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled')

  const counts = {
    active: activeBookings.length,
    checkedIn: checkedInBookings.length,
    cancelled: cancelledBookings.length,
  }

  const visible = (() => {
    switch (tab) {
      case 'active':
        return activeBookings
      case 'checkedIn':
        return checkedInBookings
      case 'cancelled':
        return cancelledBookings
    }
  })()

  function handleCancel(bookingId: string, isPaid: boolean) {
    setConfirmBookingId(bookingId)
    setConfirmIsRefund(isPaid)
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
          ? `${t('bookingDetail.cancelSuccess')} (${policy}) — ${t('bookingDetail.refundAmount')}: ${refund.toLocaleString(localeBcp)} ${t('bookingDetail.penalty')}: ${penalty.toLocaleString(localeBcp)}`
          : `${t('bookingDetail.cancelSuccess')} — ${t('bookingDetail.refundAmount')}: 0`
      setAlertMessage(summary)
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
      </div>

      {payError && (
        <div className="mb-4 px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {payError}
        </div>
      )}

      {/* List */}
      {visible.length === 0 ? (
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
            />
          ))}
        </div>
      )}

      {confirmBookingId && (
        <ConfirmModal
          open
          body={confirmIsRefund ? t('bookingDetail.refundConfirm') : t('bookingDetail.cancelConfirm')}
          variant={confirmIsRefund ? 'default' : 'danger'}
          okLabel={confirmIsRefund ? t('bookingDetail.requestRefund') : t('bookings.cancelBooking')}
          onCancel={() => setConfirmBookingId(null)}
          onConfirm={handleConfirm}
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
}: {
  booking: Booking
  onCancel: (id: string, isPaid: boolean) => void
  onPay: (id: string) => void
  isPending: boolean
  t: ReturnType<typeof useT>
  localeBcp: string
}) {
  const isCancelled = booking.status === 'cancelled'
  const isCheckedIn = booking.status === 'checked_in'
  const isCheckedOut = booking.status === 'checked_out'
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
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-display text-lg text-primary truncate">
              {booking.room_type?.name_th ?? t('bookings.roomName')}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold ${statusClass(booking.status, booking.payment_status)}`}
            >
              {statusLabel(booking.status, booking.payment_status, t)}
            </span>
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
      {!isCancelled && !isCheckedIn && !isCheckedOut && (
        <div className="flex items-center gap-2 px-4 md:px-6 pb-4">
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
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              onCancel(booking.id, isPaid)
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
        </div>
      )}
    </article>
  )
}
