import { notFound } from 'next/navigation'
import { getSession } from '@/lib/supabase/getSession'
import { getBookingById, getRefundMinDays, getRefundStatusForBooking } from '@/lib/data/bookings'
import { TransactionalHeader } from '@/components/layout/TransactionalHeader'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { ConfirmationActions } from './ConfirmationActions'
import { WriteReviewPrompt } from './WriteReviewPrompt'
import { PaymentSuccessModal } from '@/components/payment/PaymentSuccessModal'
import { RefundStatusBadge } from '@/components/booking/RefundStatusBadge'
import { LeaveGuardProvider } from '@/components/booking/LeaveGuardProvider'
import { LeaveGuardBackButton } from '@/components/booking/LeaveGuardBackButton'
import { PaymentCountdown } from '@/components/booking/PaymentCountdown'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatTHB } from '@/lib/pricing'
import { r2Url } from '@/lib/r2/publicUrl'
import { localizedName, roomTypeLabel } from '@/lib/format/roomType'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { formatDate } from '@/lib/dates'
import { refundDeadlineOrNull } from '@/lib/refund-rule'
import { roomsSearchHref } from '@/lib/booking-links'
import Image from 'next/image'
import { CancelledFromStripeBanner } from './CancelledFromStripeBanner'
import { resetPaymentWindowAction } from '@/app/actions/payment'

export const dynamic = 'force-dynamic'

function StatusBadge({
  status,
  paymentStatus,
  lapsedReason,
  t,
}: {
  status: string
  paymentStatus: string
  lapsedReason: string | null
  t: ReturnType<typeof getT>
}) {
  const isPaid = paymentStatus === 'paid'
  const isUnpaid = paymentStatus === 'unpaid'
  const isCancelled = status === 'cancelled'
  const isPaymentExpired = status === 'payment_expired'
  const isCheckedOut = status === 'checked_out'

  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-error/10 text-error text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="cancel" size={16} />
        {t('bookings.statusCancelled')}
      </span>
    )
  }
  // Since 20261011 an expired booking is status='expired'; lapsed_reason
  // tells a missed payment apart from a lapsed temp hold (same labels as
  // BookingHistory.statusLabel).
  if (isPaymentExpired || status === 'expired') {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-error/10 text-error text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="timer_off" size={16} />
        {isPaymentExpired
          ? t('bookings.statusPaymentExpired')
          : lapsedReason === 'payment_deadline'
            ? t('bookings.statusExpiredPayment')
            : t('bookings.statusExpired')}
      </span>
    )
  }
  // Phase 52 — "Awaiting payment" badge for confirmed+unpaid.
  // Rendered BEFORE the paid branch so a cancelled+unpaid (re-)booked
  // row doesn't get the wrong badge. Warning amber signals "needs
  // attention" (a non-urgent call to action — pay before the deadline).
  if (isUnpaid) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/15 text-warning text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="schedule" size={16} />
        {t('bookings.awaitingPayment')}
      </span>
    )
  }
  if (isPaid) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="verified" size={16} />
        {t('bookings.statusPaid')}
      </span>
    )
  }
  if (isCheckedOut) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="logout" size={16} />
        {t('bookings.statusCheckedOut')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-label-md font-semibold uppercase tracking-wider">
      <MaterialIcon name="schedule" size={16} />
      {t('bookings.statusPending')}
    </span>
  )
}

export default async function BookingConfirmationPage(props: PageProps<'/bookings/[id]'>) {
  const { id } = await props.params
  const sp = await props.searchParams
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  // Phase 17 — Stripe redirects back here with these query params.
  //   ?session_id=cs_test_…  → success (webhook flips payment_status='paid')
  //   ?cancelled=1           → user bailed at the Stripe-hosted page
  // The page is `force-dynamic`, so the fresh fetch already reflects the
  // webhook's payment_status flip on the success path — no extra RPC needed.
  const cancelledByUser = sp.cancelled === '1'
  const stripeSuccess =
    typeof sp.session_id === 'string' && sp.session_id.startsWith('cs_')
  const session = await getSession()
  if (!session) {
    return (
      <>
        <TopNavBar />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-body-lg text-on-surface-variant">{t('error.unauthorized')}</p>
        </main>
        <Footer />
      </>
    )
  }

  const booking = await getBookingById(id, session.id)
  if (!booking) notFound()

  // Phase 57 — one refund rule for every booking (replaces the per-policy
  // text, which promised refunds the code never gave).
  const refundMinDays = await getRefundMinDays()
  const refundDeadline = refundDeadlineOrNull(booking.check_in, refundMinDays)

  // Phase 29 — surface refund_requests.status as a badge so the user sees
  // pending / approved / rejected without having to wait for the eventual
  // bookings.payment_status flip (which only happens after Stripe webhook
  // lands, ~seconds after manager approval).
  const refundStatus = await getRefundStatusForBooking(booking.id, session.id)

  // Phase 52 — gate the leave-guard on the same condition:
  // confirmed (or temp_pending) + payment_status='unpaid'. When true,
  // the page mounts <LeaveGuardProvider> (which owns the leave dialog
  // state) + <LeaveGuardBackButton> (the fixed-position overlay that
  // intercepts the header's back-button area). When false, the
  // header's plain <Link> is the only back control.
  const isUnpaidActive =
    booking.payment_status === 'unpaid' &&
    (booking.status === 'confirmed' || booking.status === 'temp_pending')

  // Phase 52 follow-up — return-from-Stripe cancel_url: reset the
  // 5-min window + un-expire if needed. Server-side, fire-and-forget
  // (we don't block the render on it). The visible banner still shows
  // unconditionally; the next read will pick up the post-reset state.
  if (cancelledByUser && isUnpaidActive) {
    try {
      await resetPaymentWindowAction({ bookingId: booking.id })
    } catch (e) {
      console.warn(
        '[bookings/[id]] resetPaymentWindowAction failed:',
        e,
      )
    }
  }

  return (
    <>
      <TopNavBar />
      {/* Stripe success modal — mounts when ?session_id=cs_… is in the
          URL. Modal handles webhook race internally: polls every 2s
          for up to 30s waiting for payment_status='paid' before
          showing success content (Phase 27 — see PaymentSuccessModal
          and pollBookingPaymentStatusAction in app/actions/payment.ts). */}
      {stripeSuccess && (
        <PaymentSuccessModal
          bookingId={booking.id}
          initialPaymentStatus={booking.payment_status}
        />
      )}
      {/*
        Phase 52 follow-up (RSC fix) — the page wraps the main
        content in <LeaveGuardProvider> only when the booking is
        unpaid+active. For paid/cancelled/expired bookings, no
        provider is mounted and the header's plain <Link> is the
        only back control. The provider receives only serializable
        props (bookingId, enabled, backHref) — no function props
        cross the server→client boundary.
      */}
      <LeaveGuardProvider
        bookingId={booking.id}
        enabled={isUnpaidActive}
        backHref="/bookings"
      >
        {isUnpaidActive && <LeaveGuardBackButton />}
        <TransactionalHeader backHref="/bookings" />
        <main className="flex-1 bg-background">
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-8">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="font-display text-3xl text-primary">{t('bookingDetail.title')}</h1>
            <StatusBadge status={booking.status} paymentStatus={booking.payment_status} lapsedReason={booking.lapsed_reason} t={t} />
            {refundStatus && (
              <RefundStatusBadge
                status={refundStatus.status}
                amountFormatted={formatTHB(refundStatus.amount, localeBcp)}
                t={t}
              />
            )}
          </div>
          <p className="text-body-md text-on-surface-variant mb-8">
            {t('bookingDetail.bookingCode')}: <span className="font-mono font-semibold">#{booking.booking_code}</span>
          </p>

          {cancelledByUser && booking.status !== 'cancelled' && booking.payment_status === 'unpaid' && (
            // Phase 52 — only show the actionable banner when the booking
            // is still unpaid+active. After cancel, the page renders the
            // standard cancelled state (no banner needed).
            <CancelledFromStripeBanner bookingId={booking.id} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8">
            {/* LEFT */}
            <div className="flex flex-col gap-6">
              {/* Room summary */}
              <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant flex gap-4">
                <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-surface-container shrink-0">
                  {booking.room_type && (
                    <Image
                      src={r2Url(booking.room_type.hero_image_key)}
                      alt={booking.room_type.name}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-xl text-primary">
                    {localizedName(booking.room_type, locale) || t('bookings.roomName')}
                  </h2>
                  {booking.room_type?.type && (
                    <p className="text-caption text-secondary font-semibold uppercase tracking-wider mt-1">
                      {t('bookingDetail.roomType')}: {roomTypeLabel(booking.room_type.type, locale)}
                    </p>
                  )}
                  <p className="text-caption text-on-surface-variant uppercase tracking-wider mt-1">
                    {t('bookingDetail.nights', { count: booking.nights })} · {t('bookings.guestsCount', { count: booking.guests })}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-body-md">
                    <div>
                      <p className="text-caption text-on-surface-variant uppercase tracking-wider">{t('bookingDetail.checkInDate')}</p>
                      <p className="font-medium text-on-surface">{formatDate(booking.check_in, localeBcp)}</p>
                    </div>
                    <div>
                      <p className="text-caption text-on-surface-variant uppercase tracking-wider">{t('bookingDetail.checkOutDate')}</p>
                      <p className="font-medium text-on-surface">{formatDate(booking.check_out, localeBcp)}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Booker info */}
              <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
                <h2 className="font-display text-xl text-primary mb-4">{t('bookingDetail.guestInfo')}</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DataRow label={t('auth.fullName')} value={booking.booker_full_name} />
                  <DataRow label={t('auth.email')} value={booking.booker_email} />
                  <DataRow label={t('auth.phone')} value={booking.booker_phone ?? '—'} />
                </dl>
                {booking.special_request && (
                  <div className="mt-4 pt-4 border-t border-outline-variant">
                    <p className="text-caption text-on-surface-variant uppercase tracking-wider mb-1">Special request</p>
                    <p className="text-body-md text-on-surface">{booking.special_request}</p>
                  </div>
                )}
              </section>

              {/* Cancellation policy */}
              <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
                <h2 className="font-display text-xl text-primary mb-2">{t('bookingDetail.cancellationPolicy')}</h2>
                <div className="flex flex-col gap-2 text-body-md">
                    <p className="text-on-surface-variant text-body-md">
                      {t('bookingDetail.refundRule', { min: refundMinDays })}
                    </p>
                    {/* Phase 57c — the concrete last day for this booking */}
                    {booking.status === 'confirmed' && (
                      refundDeadline ? (
                        <p className="text-body-md font-medium text-on-surface">
                          {t('bookingDetail.refundUntilDate', { date: formatDate(refundDeadline, localeBcp) })}
                        </p>
                      ) : (
                        <p className="text-body-md font-medium text-error">{t('bookingDetail.refundNoLonger')}</p>
                      )
                    )}
                    {/* Phase 52 — free-cancel hint for confirmed+unpaid
                        bookings. Signals to the customer that they can
                        cancel without penalty (no payment taken yet). */}
                    {isUnpaidActive && (
                      <p className="text-caption text-success font-medium mt-1">
                        {t('bookingDetail.freeCancelUnpaid')}
                      </p>
                    )}
                  </div>
              </section>

              {/* Review prompt — only after checkout */}
              {booking.status === 'checked_out' && booking.room_type ? (
                <WriteReviewPrompt
                  bookingId={booking.id}
                  roomTypeId={booking.room_type.id}
                  roomTypeName={localizedName(booking.room_type, locale)}
                />
              ) : null}
            </div>

            {/* RIGHT: Price summary + actions */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) border border-outline-variant p-6">
                <h2 className="font-display text-xl text-primary mb-4">{t('bookingDetail.priceBreakdown')}</h2>

                <div className="flex flex-col gap-2 text-body-md">
                  <PriceRow label={t('bookingDetail.basePrice')} value={formatTHB(booking.base_subtotal, localeBcp)} />
                  {Number(booking.discount_total) > 0 && (
                    <PriceRow
                      label={t('bookingDetail.discount')}
                      value={`-${formatTHB(booking.discount_total, localeBcp)}`}
                      discount
                    />
                  )}
                  <PriceRow label={t('bookingDetail.tax')} value={formatTHB(booking.tax_total, localeBcp)} />
                  <PriceRow label={t('bookingDetail.serviceFee')} value={formatTHB(booking.fee_total, localeBcp)} />
                </div>

                <div className="my-4 border-t border-outline-variant" />
                <PriceRow label={t('bookingDetail.totalPrice')} value={formatTHB(booking.total, localeBcp)} emphasis />

                <ConfirmationActions
                  bookingId={booking.id}
                  status={booking.status}
                  paymentStatus={booking.payment_status}
                  refundRequested={refundStatus !== null}
                  lapsedReason={booking.lapsed_reason}
                  roomsHref={roomsSearchHref(booking)}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      {/* Phase 56 — deadline + live countdown (PaymentCountdown). Sits
          outside <main> so it stays visible as the user scrolls. */}
      {isUnpaidActive && booking.payment_due_at && (
        <div className="bg-warning/10 border-t border-warning/30">
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <p className="font-caption text-caption text-on-surface font-semibold">
              <PaymentCountdown deadlineIso={booking.payment_due_at} />
            </p>
            <p className="font-caption text-caption text-on-surface-variant">
              {t('bookings.unpaidDeadlineSubtext')}
            </p>
          </div>
        </div>
      )}
      {/* Phase 52 follow-up — leave-guard provider is mounted above
          (wraps the main content + the back-button overlay). The
          BookingUnpaidGuard is GONE — its responsibilities are
          absorbed by LeaveGuardProvider. */}
    </LeaveGuardProvider>
    </>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-on-surface-variant uppercase tracking-wider">{label}</dt>
      <dd className="text-body-md text-on-surface font-medium mt-1">{value}</dd>
    </div>
  )
}

function PriceRow({
  label,
  value,
  emphasis,
  discount,
}: {
  label: string
  value: string
  emphasis?: boolean
  discount?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          emphasis
            ? 'text-body-md font-bold text-primary'
            : discount
            ? 'text-body-md text-error'
            : 'text-body-md text-on-surface-variant'
        }
      >
        {label}
      </span>
      <span
        className={
          emphasis
            ? 'text-lg font-display font-bold text-primary'
            : discount
            ? 'text-body-md font-medium text-error'
            : 'text-body-md text-on-surface'
        }
      >
        {value}
      </span>
    </div>
  )
}
