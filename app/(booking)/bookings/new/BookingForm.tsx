'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useTransition, useMemo } from 'react'
import { useFormStatus } from 'react-dom'
import {
  createBooking,
  completeTempBookingAction,
  type CreateBookingResult,
} from '@/app/actions/booking'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'
import { useLocale } from '@/lib/i18n/useT'
import { localizedName } from '@/lib/format/roomType'
import { calculatePrice, formatTHB, type PricingSettings } from '@/lib/pricing'
import { r2Url } from '@/lib/r2/publicUrl'
import type { QuoteResult } from '@/lib/pricing/seasons'
import { formatDate } from '@/lib/dates'
import { refundDeadlineOrNull } from '@/lib/refund-rule'
import type { Booking } from '@/lib/data/bookings'

interface BookingFormProps {
  room: {
    id: string
    slug: string
    name: string
    name_th: string
    hero_image_key: string
    base_price: number
  }
  checkIn?: string
  checkOut?: string
  guests?: number
  profile?: {
    fullName: string
    email: string
    phone: string
  }
  /**
   * Phase 42 — when provided, form operates in "complete existing temp
   * booking" mode. The form pre-fills from this booking's data, locks
   * room/dates/guests, and submit calls `completeTempBookingAction` to
   * flip status to 'confirmed' (same row, not a new insert).
   */
  existingBooking?: Booking
  /** Phase 8 — server-computed quote (already includes seasonal rate nightly breakdown). */
  quote: QuoteResult
  /** True when an applied seasonal rate has min_nights_override > stay length. */
  minNightsBlocked: boolean
  /**
   * Phase 12 — live tax + resort fee from `hotel_settings`, fetched by the
   * server page. Falls back to `DEFAULT_PRICING` (0.07 / 150) at the server
   * if the singleton row is missing; this preview matches the value the
   * server action will write into `bookings.tax_total` / `fee_total`.
   */
  settings: PricingSettings
  /** Phase 57c — refund_min_days_before_checkin() from the DB. */
  refundMinDays: number
}

function SubmitButton({
  disabled,
  label,
}: {
  disabled: boolean
  label: string
}) {
  const { pending } = useFormStatus()
  const t = useT()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          {t('customer.common.processing')}
        </>
      ) : (
        <>
          <MaterialIcon name="lock" size={18} />
          {label}
        </>
      )}
    </button>
  )
}

/**
 * Phase 50 — HoldCountdown removed. The leave-guard (BookingHoldGuard)
 * now owns the entire hold lifecycle: 30s heartbeat extends the lease
 * silently, the idle-guard releases on 5 min no interaction, and the
 * leave dialog intercepts navigation. No user-facing timer.
 */

export function BookingForm(props: BookingFormProps) {
  const { room, quote, minNightsBlocked, settings } = props

  // Phase 42 — derive mode + values from either existingBooking (new path)
  // or checkIn/checkOut/guests/profile (legacy path).
  const isCompletingExisting = Boolean(props.existingBooking)
  const existing = props.existingBooking
  const checkIn = existing?.check_in ?? props.checkIn ?? ''
  const checkOut = existing?.check_out ?? props.checkOut ?? ''
  const guests = existing?.guests ?? props.guests ?? 1
  const initialFullName =
    existing?.booker_full_name ?? props.profile?.fullName ?? ''
  // Phase 51 — the booking email is locked to the authenticated account.
  // It is read from the existing temp booking (bookingId path) or the
  // profile prop (legacy path, where the page reads from auth.users.email).
  // It is NEVER collected from the form — the server action derives it
  // from the session again (defense in depth) before passing to the RPC.
  const lockedEmail = existing?.booker_email ?? props.profile?.email ?? ''
  const initialPhone = existing?.booker_phone ?? props.profile?.phone ?? ''

  const router = useRouter()
  const t = useT()
  const locale = useLocale()
  const [state, setState] = useState<CreateBookingResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(
    initialPhone && initialPhone !== '0000000000' ? initialPhone : '',
  )
  const [specialRequest, setSpecialRequest] = useState(
    existing?.special_request ?? '',
  )
  const [promoCode, setPromoCode] = useState('')
  // Phase 57c — the guest must accept the refund rule before booking
  // (also enforced by the server schema).
  const [acceptRefund, setAcceptRefund] = useState(false)
  const refundDeadline = checkIn ? refundDeadlineOrNull(checkIn, props.refundMinDays) : null

  // Phase 8 — quote is computed server-side. Pass it to calculatePrice so
  // baseSubtotal reflects any active seasonal rates for the stay window.
  // Phase 12 — also pass `settings` so the preview matches the live
  // `hotel_settings.tax_rate` / `resort_fee` the server action will use.
  const price = useMemo(
    () =>
      calculatePrice(
        {
          basePrice: room.base_price,
          checkIn,
          checkOut,
          guests,
          quote,
        },
        settings,
      ),
    [room.base_price, checkIn, checkOut, guests, quote, settings],
  )
  const nights = quote.nights

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Submit is disabled until the refund rule is accepted; this also keeps
    // a keyboard submit from skipping the checkbox.
    if (!acceptRefund) return
    if (isCompletingExisting && existing) {
      // Phase 42 path — complete existing temp booking.
      startTransition(async () => {
        const result = await completeTempBookingAction({
          bookingId: existing.id,
          bookerFullName: fullName,
          bookerPhone: phone,
          specialRequest: specialRequest || undefined,
          promoCode: promoCode || undefined,
          acceptRefundRule: true,
        })
        if (!result.ok || result.error) {
          setState({ error: result.error })
          return
        }
        if (result.bookingId) {
          router.push(`/bookings/${result.bookingId}`)
        }
      })
      return
    }

    // Legacy path — create a brand-new booking row.
    startTransition(async () => {
      const result = await createBooking({
        roomTypeId: room.id,
        checkIn,
        checkOut,
        guests,
        bookerFullName: fullName,
        bookerPhone: phone,
        specialRequest: specialRequest || undefined,
        promoCode: promoCode || undefined,
        acceptRefundRule: true,
      })

      if (result.error) {
        setState({ error: result.error })
        return
      }

      if (result.bookingId) {
        router.push(`/bookings/${result.bookingId}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8">
      {/* LEFT: Form fields */}
      <div className="flex flex-col gap-6">
        {state?.error && (
          <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
            {state.error}
          </div>
        )}

        {minNightsBlocked && (
          <div className="px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg text-body-md text-warning">
            {t('customer.bookingForm.minNightsBlock')}
          </div>
        )}

        {/* Booker info */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">{t('customer.bookingForm.bookerHeading')}</h2>
          <div className="flex flex-col gap-4">
            <Field label={t('auth.fullName')} required>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </Field>
            <Field label={t('auth.email')} required>
              {/* Phase 51 — email is locked to the authenticated account.
                  readOnly + aria-readonly keeps the field focusable + selectable
                  (a `disabled` input would be skipped by some screen readers and
                  lose text selection). The lock icon + helper text signal the
                  intent visually. The server action derives the email from the
                  session regardless of any value the form sends. */}
              <div className="relative">
                <input
                  type="email"
                  value={lockedEmail}
                  readOnly
                  aria-readonly="true"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg py-3 pl-4 pr-12 text-body-md text-on-surface-variant cursor-not-allowed"
                />
                <MaterialIcon
                  name="lock"
                  aria-label={t('customer.bookingForm.emailLocked')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant pointer-events-none"
                />
              </div>
              <p className="font-caption text-caption text-on-surface-variant">
                {t('bookingForm.emailLockedHint')}
              </p>
            </Field>
            <Field label={t('auth.phone')} required>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                minLength={10}
                required
                pattern="[0-9]{10}"
                placeholder="08xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
              <p className="font-caption text-caption text-on-surface-variant">
                {t('customer.bookingForm.phoneHint')}
              </p>
            </Field>
            <Field label={t('customer.bookingForm.special')}>
              <textarea
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                rows={3}
                placeholder={t('customer.bookingForm.specialPlaceholder')}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors resize-none"
              />
            </Field>
          </div>
        </section>

        {/* Promo code */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">{t('customer.bookingForm.promoHeading')}</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="PROMO15"
              className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
            />
            <button
              type="button"
              className="px-6 py-3 border border-primary text-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
            >
              {t('customer.bookingForm.applyCode')}
            </button>
          </div>
        </section>
      </div>

      {/* RIGHT: Sticky summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) border border-outline-variant overflow-hidden">
          {/* Room image */}
          <div className="relative aspect-[16/10] bg-surface-container">
            <Image
              src={r2Url(room.hero_image_key)}
              alt={room.name}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>

          <div className="p-6">
            <h3 className="font-display text-xl text-primary">{localizedName(room, locale)}</h3>

            <div className="mt-4 flex flex-col gap-2 text-body-md">
              <SummaryRow icon="event" label={t('customer.common.checkIn')} value={formatDate(checkIn)} />
              <SummaryRow icon="event" label={t('customer.common.checkOut')} value={formatDate(checkOut)} />
              <SummaryRow icon="schedule" label={t('customer.common.nightsLabel')} value={t('customer.common.nights', { count: nights })} />
              <SummaryRow icon="group" label={t('customer.common.guestsLabel')} value={t('customer.common.guests', { count: guests })} />
            </div>

            <div className="my-4 border-t border-outline-variant" />

            <div className="flex flex-col gap-2 text-body-md">
              {quote.appliedRates.length > 0 ? (
                <>
                  <PriceRow label={t('customer.bookingForm.baseLine', { price: formatTHB(room.base_price), nights })} value={formatTHB(nights * room.base_price)} />
                  {quote.appliedRates.map((applied) => (
                    <div key={applied.id} className="ml-4 flex flex-col gap-1 text-caption text-on-surface-variant">
                      <span className="italic">{t('customer.common.seasonalLine', { label: applied.label, nights: applied.nights })}</span>
                      {applied.minNightsOverride != null && (
                        <span className="text-warning">{t('customer.common.minNights', { count: applied.minNightsOverride })}</span>
                      )}
                    </div>
                  ))}
                  <PriceRow label={t('customer.bookingForm.roomSubtotal')} value={formatTHB(price.baseSubtotal)} emphasis />
                </>
              ) : (
                <PriceRow label={t('customer.common.priceTimesNights', { price: formatTHB(room.base_price), nights })} value={formatTHB(price.baseSubtotal)} />
              )}
              <PriceRow label={t('customer.common.taxPct', { pct: Math.round(settings.taxRate * 100) })} value={formatTHB(price.taxTotal)} />
              <PriceRow label={t('customer.common.resortFeePerNight', { fee: formatTHB(settings.resortFeePerNight) })} value={formatTHB(price.feeTotal)} />
            </div>

            <div className="my-4 border-t border-outline-variant" />
            <PriceRow label={t('customer.common.total')} value={formatTHB(price.total)} emphasis />

            {/* Phase 57c — refund rule for this check-in date, accepted before booking */}
            <div
              className={`mt-6 rounded-lg border px-4 py-3 text-caption ${
                refundDeadline ? 'border-outline-variant bg-surface-container-low' : 'border-error/30 bg-error/10'
              }`}
            >
              <p className="font-semibold text-on-surface mb-1">{t('customer.bookingForm.refundHeading')}</p>
              <p className={refundDeadline ? 'text-on-surface-variant' : 'text-error'}>
                {refundDeadline
                  ? t('customer.bookingForm.refundUntil', { date: formatDate(refundDeadline), min: props.refundMinDays })
                  : t('customer.bookingForm.refundNone', { min: props.refundMinDays })}
              </p>
              <label className="mt-3 flex items-start gap-2 cursor-pointer text-on-surface">
                <input
                  type="checkbox"
                  checked={acceptRefund}
                  onChange={(e) => setAcceptRefund(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                  required
                />
                <span>{t('customer.bookingForm.acceptRefundRule')}</span>
              </label>
            </div>

            <SubmitButton
              disabled={isPending || nights === 0 || minNightsBlocked || !acceptRefund}
              label={t('customer.bookingForm.confirmPay')}
            />

            <p className="mt-4 text-caption text-on-surface-variant text-center">
              {t('customer.bookingForm.afterNote')}
            </p>
          </div>
        </div>
      </div>
    </form>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-md text-on-surface">
        {label}
        {required && <span className="text-error">*</span>}
      </span>
      {children}
    </label>
  )
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <MaterialIcon name={icon} size={18} className="text-primary" />
      <span className="text-on-surface-variant">{label}</span>
      <span className="ml-auto font-medium text-on-surface">{value}</span>
    </div>
  )
}

function PriceRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasis ? 'text-body-md font-bold text-primary' : 'text-body-md text-on-surface-variant'}>
        {label}
      </span>
      <span className={emphasis ? 'text-lg font-display font-bold text-primary' : 'text-body-md text-on-surface'}>
        {value}
      </span>
    </div>
  )
}
