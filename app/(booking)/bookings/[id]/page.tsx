import { notFound } from 'next/navigation'
import { getSession } from '@/lib/supabase/getSession'
import { getBookingById, getCancellationPolicyById, getDefaultCancellationPolicy, getRefundStatusForBooking } from '@/lib/data/bookings'
import { TransactionalHeader } from '@/components/layout/TransactionalHeader'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { ConfirmationActions } from './ConfirmationActions'
import { WriteReviewPrompt } from './WriteReviewPrompt'
import { PaymentSuccessModal } from '@/components/payment/PaymentSuccessModal'
import { RefundStatusBadge } from '@/components/booking/RefundStatusBadge'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatTHB } from '@/lib/pricing'
import { r2Url } from '@/lib/r2/publicUrl'
import { roomTypeLabel } from '@/lib/format/roomType'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { formatDate } from '@/lib/dates'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

function StatusBadge({
  status,
  paymentStatus,
  t,
}: {
  status: string
  paymentStatus: string
  t: ReturnType<typeof getT>
}) {
  const isPaid = paymentStatus === 'paid'
  const isCancelled = status === 'cancelled'
  const isCheckedOut = status === 'checked_out'

  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-error/10 text-error text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="cancel" size={16} />
        {t('bookings.statusCancelled')}
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

  // Phase 27 — render the cancellation policy that applies to this
  // booking (linked via cancellation_policy_id, falling back to the
  // seeded default if the booking has no linked policy). Done
  // server-side so the dead placeholder at the bottom of the page
  // (was just rendering the totalPrice label) actually displays.
  const policy =
    (booking.cancellation_policy_id
      ? await getCancellationPolicyById(booking.cancellation_policy_id)
      : null) ?? (await getDefaultCancellationPolicy())

  // Phase 29 — surface refund_requests.status as a badge so the user sees
  // pending / approved / rejected without having to wait for the eventual
  // bookings.payment_status flip (which only happens after Stripe webhook
  // lands, ~seconds after manager approval).
  const refundStatus = await getRefundStatusForBooking(booking.id, session.id)

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
      <main className="flex-1 bg-background">
        <TransactionalHeader backHref="/bookings" />
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-8">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="font-display text-3xl text-primary">{t('bookingDetail.title')}</h1>
            <StatusBadge status={booking.status} paymentStatus={booking.payment_status} t={t} />
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

          {cancelledByUser && (
            <div className="mb-6 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-3">
              <MaterialIcon name="info" size={20} />
              <p className="text-body-md text-on-surface">
                {t('bookingDetail.cancelSuccess')}
              </p>
            </div>
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
                    {booking.room_type?.name_th ?? t('bookings.roomName')}
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
                {policy ? (
                  <div className="flex flex-col gap-2 text-body-md">
                    <p className="font-semibold text-on-surface">{policy.name}</p>
                    <p className="text-on-surface-variant text-body-md">
                      {t('bookingDetail.policyWindow', {
                        hours: policy.free_cancel_hours,
                        pct: policy.refund_pct,
                      })}
                    </p>
                    {policy.description && (
                      <p className="text-caption text-on-surface-variant">{policy.description}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant">
                    {t('bookingDetail.cancellationPolicy')} —
                  </p>
                )}
              </section>

              {/* Review prompt — only after checkout */}
              {booking.status === 'checked_out' && booking.room_type ? (
                <WriteReviewPrompt
                  bookingId={booking.id}
                  roomTypeId={booking.room_type.id}
                  roomTypeName={booking.room_type.name_th ?? booking.room_type.name}
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
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
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
