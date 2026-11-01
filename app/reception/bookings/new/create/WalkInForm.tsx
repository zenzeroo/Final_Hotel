'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, useMemo } from 'react'
import { createWalkInBooking } from '@/app/actions/walk-in-booking'
import { createWalkInCheckoutSessionAction } from '@/app/actions/payment'
import { calculateNights, calculatePrice, formatTHB } from '@/lib/pricing'
import { getMinCheckInLocalIso, addDaysLocalIso, formatDateNumeric } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useLocale, useT } from '@/lib/i18n/useT'
import { localizedName } from '@/lib/format/roomType'

interface WalkInFormProps {
  room: {
    id: string
    slug: string
    name: string
    name_th: string
    hero_image_key: string
    base_price: number
    max_guests: number
  }
}

export function WalkInForm({ room }: WalkInFormProps) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const urlParams = useSearchParams()
  // Phase 45 — pre-fill dates/guests from URL params when the receptionist
  // navigates here from the picker (which forwards checkin/checkout/guests
  // via the card href). Fallback to tomorrow/day-after/1 when missing.
  // Phase 45.1 — defaults moved to `getMinCheckInLocalIso()` (tomorrow)
  // instead of local `getTodayIso()` (today). Hotels require ≥ 1 day
  // advance booking — same constraint enforced by SearchBar +
  // BookingWidget via the same helper.
  const minCheckin = getMinCheckInLocalIso()
  const defaultCheckout = addDaysLocalIso(minCheckin, 1)
  const urlCheckIn = urlParams.get('checkin')
  const urlCheckOut = urlParams.get('checkout')
  const urlGuestsRaw = urlParams.get('guests')
  const urlGuestsParsed = urlGuestsRaw ? parseInt(urlGuestsRaw, 10) : NaN
  const initialCheckIn = urlCheckIn && urlCheckIn >= minCheckin ? urlCheckIn : minCheckin
  const initialCheckOut =
    urlCheckOut && urlCheckOut > initialCheckIn ? urlCheckOut : defaultCheckout
  const initialGuests = Number.isFinite(urlGuestsParsed) && urlGuestsParsed > 0
    ? Math.min(urlGuestsParsed, room.max_guests)
    : 1

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Set when the booking was created but Stripe couldn't open — the form
  // must not be submitted again (it would create a second booking).
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null)
  // Fixed on this page — see the locked "stay dates" section below.
  const checkIn = initialCheckIn
  const checkOut = initialCheckOut
  const guests = initialGuests
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [specialRequest, setSpecialRequest] = useState('')
  // Phase 17 — replaces `markAsPaid` boolean. `card` triggers a Stripe
  // Checkout redirect in the submit handler. `unpaid` is for "pay later"
  // walk-ins (folio created, payment collected later at desk).
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'unpaid'>('cash')

  const nights = useMemo(() => calculateNights(checkIn, checkOut), [checkIn, checkOut])
  const price = useMemo(
    () =>
      calculatePrice({
        basePrice: room.base_price,
        checkIn,
        checkOut,
        guests,
      }),
    [room.base_price, checkIn, checkOut, guests]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      // Walk-in guests have no auth.users row — the dedicated server action
      // uses the service role to find or create the guest's account, then
      // inserts the booking with channel='walk_in' + payment_status=paid/unpaid.
      const result = await createWalkInBooking({
        roomTypeId: room.id,
        checkIn,
        checkOut,
        guests,
        bookerFullName: fullName,
        bookerEmail: email,
        bookerPhone: phone,
        specialRequest: specialRequest || undefined,
        paymentMethod,
      })

      if (result.error || !result.bookingId) {
        setError(result.error ?? t('reception.walkIn.createFailed'))
        return
      }

      // Card / PromptPay — open Stripe Checkout for the new booking. The
      // webhook marks it paid; Stripe returns to the read-only booking page.
      if (paymentMethod === 'card') {
        const pay = await createWalkInCheckoutSessionAction({ bookingId: result.bookingId })
        if (pay.ok && pay.data?.url) {
          window.location.href = pay.data.url
          return
        }
        setCreatedBookingId(result.bookingId)
        setError(t('reception.walkIn.stripeFailed', { detail: pay.ok ? 'no URL' : pay.error }))
        return
      }

      router.push(`/reception/bookings?status=all`)
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start"
    >
      {/* LEFT: who is staying, then how they pay. */}
      <div className="flex flex-col gap-6">
        {error && (
          <div role="alert" className="px-4 py-3 bg-error-container rounded-xl text-body-md text-on-error-container">
            {error}
            {createdBookingId && (
              <Link
                href={`/reception/bookings/${createdBookingId}`}
                className="block mt-1 font-semibold underline underline-offset-2"
              >
                {t('reception.walkIn.openBooking')}
              </Link>
            )}
          </div>
        )}

        <section className="bg-surface-container-lowest rounded-2xl p-6 md:p-8">
          <h2 className="font-display text-xl text-primary mb-5">{t('reception.walkIn.guestInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
            <Field label={t('reception.walkIn.fullName')} required wide>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                className="input"
              />
            </Field>
            <Field label={t('reception.walkIn.email')} required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input"
              />
            </Field>
            <Field label={t('reception.walkIn.phone')} required hint={t('reception.walkIn.phoneHint')}>
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
                className="input tabular-nums"
              />
            </Field>
            <Field label={t('reception.walkIn.specialRequests')} wide>
              <textarea
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                rows={3}
                placeholder={t('reception.walkIn.specialPlaceholder')}
                className="input resize-none"
              />
            </Field>
          </div>
        </section>

        <fieldset className="bg-surface-container-lowest rounded-2xl p-6 md:p-8">
          <legend className="sr-only">{t('reception.walkIn.paymentMethod')}</legend>
          <p aria-hidden className="font-display text-xl text-primary mb-5">{t('reception.walkIn.paymentMethod')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <PaymentOption
              value="cash"
              icon="payments"
              label={t('reception.walkIn.payCash')}
              description={t('reception.walkIn.payCashDesc')}
              selected={paymentMethod === 'cash'}
              onSelect={() => setPaymentMethod('cash')}
            />
            <PaymentOption
              value="card"
              icon="credit_card"
              label={t('reception.walkIn.payCard')}
              description={t('reception.walkIn.payCardDesc')}
              selected={paymentMethod === 'card'}
              onSelect={() => setPaymentMethod('card')}
            />
            <PaymentOption
              value="unpaid"
              icon="schedule"
              label={t('reception.walkIn.payLater')}
              description={t('reception.walkIn.payLaterDesc')}
              selected={paymentMethod === 'unpaid'}
              onSelect={() => setPaymentMethod('unpaid')}
            />
          </div>
        </fieldset>
      </div>

      {/* RIGHT: what is being booked, what it costs, and the one action. */}
      <aside className="lg:sticky lg:top-6 bg-surface-container-lowest rounded-2xl p-6 md:p-8">
        <p className="text-[14px] font-medium text-on-surface-variant">{t('reception.walkIn.summary')}</p>
        <h2 className="mt-1 font-display text-2xl leading-[1.25] text-primary">{localizedName(room, locale)}</h2>

        {/* Locked: dates and guests were chosen on the room picker, whose
            list only shows rooms free for them. Changing them goes back
            there so availability is checked again. */}
        <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-surface-container-low p-4">
          <StayFact label={t('reception.walkIn.checkIn')} value={formatDateNumeric(checkIn)} />
          <StayFact label={t('reception.walkIn.checkOut')} value={formatDateNumeric(checkOut)} />
          <StayFact label={t('reception.walkIn.guests')} value={t('reception.common.guestsN', { count: guests })} />
        </dl>
        <Link
          href={`/reception/bookings/new?checkin=${checkIn}&checkout=${checkOut}&guests=${guests}`}
          title={t('reception.walkIn.changeStay')}
          className="mt-2 inline-flex items-center gap-1.5 min-h-11 text-[14px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <MaterialIcon name="edit_calendar" size={18} />
          {t('reception.walkIn.change')}
        </Link>

        <div className="mt-4 flex flex-col gap-2 text-body-md tabular-nums">
          <PriceRow
            label={t('reception.walkIn.priceXNights', { price: formatTHB(room.base_price), count: nights })}
            value={formatTHB(price.baseSubtotal)}
          />
          <PriceRow label={t('reception.walkIn.tax')} value={formatTHB(price.taxTotal)} />
          <PriceRow label={t('reception.walkIn.resortFee')} value={formatTHB(price.feeTotal)} />
        </div>
        <div className="mt-4 pt-4 border-t border-surface-container flex justify-between items-baseline gap-4">
          <span className="text-body-md font-semibold text-on-surface">{t('reception.walkIn.grandTotal')}</span>
          <span className="font-display text-[28px] leading-none text-primary tabular-nums">{formatTHB(price.total)}</span>
        </div>

        <button
          type="submit"
          disabled={isPending || !!createdBookingId || nights === 0 || !fullName || !email || !phone}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 h-12 px-6 bg-primary text-on-primary rounded-xl font-semibold text-body-md hover:bg-primary-container transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          {isPending ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              {t('reception.walkIn.creating')}
            </>
          ) : (
            <>
              <MaterialIcon name="check_circle" size={20} />
              {t('reception.walkIn.confirm')}
            </>
          )}
        </button>
      </aside>

      <style jsx>{`
        .input {
          width: 100%;
          background: var(--color-surface-container-low);
          border: 1px solid transparent;
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          min-height: 2.75rem;
          font-size: 1rem;
          color: var(--color-on-surface);
          transition: border-color 0.2s, background-color 0.2s;
        }
        .input:focus {
          outline: none;
          background: var(--color-surface-container-lowest);
          border-color: var(--color-secondary);
        }
      `}</style>
    </form>
  )
}

function StayFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 text-body-md font-semibold text-on-surface tabular-nums">{value}</dd>
    </div>
  )
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface">{value}</span>
    </div>
  )
}

function Field({
  label,
  required,
  wide,
  hint,
  children,
}: {
  label: string
  required?: boolean
  /** Spans both columns. */
  wide?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-[14px] font-medium text-on-surface">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[13px] text-on-surface-variant">{hint}</span>}
    </label>
  )
}

function PaymentOption({
  value,
  icon,
  label,
  description,
  selected,
  onSelect,
}: {
  value: 'cash' | 'card' | 'unpaid'
  icon: string
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={`relative flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-secondary ${
        selected ? 'border-primary bg-primary/5' : 'border-surface-container hover:border-outline-variant'
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex items-center justify-between gap-2">
        <MaterialIcon name={icon} size={22} className={selected ? 'text-primary' : 'text-on-surface-variant'} />
        <span
          aria-hidden
          className={`w-5 h-5 rounded-full border-2 grid place-items-center ${selected ? 'border-primary' : 'border-outline-variant'}`}
        >
          {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
        </span>
      </span>
      <span className="text-body-md font-semibold text-on-surface">{label}</span>
      <span className="text-[13px] leading-snug text-on-surface-variant">{description}</span>
    </label>
  )
}
