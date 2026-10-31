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
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      {/* LEFT: form */}
      <div className="flex flex-col gap-4">
        {error && (
          <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
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

        <div className="bg-surface-container-lowest rounded-lg p-6 shadow-level-1">
          <h2 className="font-display text-xl text-primary mb-4">{t('reception.walkIn.guestInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('reception.walkIn.fullName')} required>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label={t('reception.walkIn.email')} required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label={t('reception.walkIn.phone')} required>
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
                className="input"
              />
              <p className="font-caption text-caption text-on-surface-variant">
                {t('reception.walkIn.phoneHint')}
              </p>
            </Field>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-lg p-6 shadow-level-1">
          <h2 className="font-display text-xl text-primary mb-4">{t('reception.walkIn.stayDates')}</h2>
          {/* Locked: dates and guests were chosen on the room picker, whose
              list only shows rooms free for them. Changing them goes back
              there so availability is checked again. */}
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 rounded-lg bg-surface-container border border-outline-variant">
            <LockedValue icon="login" label={t('reception.walkIn.checkIn')} value={formatDateNumeric(checkIn)} />
            <LockedValue icon="logout" label={t('reception.walkIn.checkOut')} value={formatDateNumeric(checkOut)} />
            <LockedValue icon="group" label={t('reception.walkIn.guests')} value={t('reception.common.guestsN', { count: guests })} />
            <MaterialIcon name="lock" size={18} className="ml-auto text-on-surface-variant" aria-hidden />
          </dl>
          <Link
            href={`/reception/bookings/new?checkin=${checkIn}&checkout=${checkOut}&guests=${guests}`}
            className="mt-3 inline-flex items-center gap-1.5 text-caption text-primary hover:underline underline-offset-2"
          >
            <MaterialIcon name="edit_calendar" size={16} />
            {t('reception.walkIn.changeStay')}
          </Link>
        </div>

        <div className="bg-surface-container-lowest rounded-lg p-6 shadow-level-1">
          <h2 className="font-display text-xl text-primary mb-4">{t('reception.walkIn.specialRequests')}</h2>
          <textarea
            value={specialRequest}
            onChange={(e) => setSpecialRequest(e.target.value)}
            rows={3}
            placeholder={t('reception.walkIn.specialPlaceholder')}
            className="input resize-none w-full"
          />
        </div>

        <fieldset className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
          <legend className="px-2 text-label-md text-on-surface font-semibold">
            {t('reception.walkIn.paymentMethod')}
          </legend>
          <div className="flex flex-col gap-2">
            <PaymentOption
              value="cash"
              label={t('reception.walkIn.payCash')}
              description={t('reception.walkIn.payCashDesc')}
              selected={paymentMethod === 'cash'}
              onSelect={() => setPaymentMethod('cash')}
            />
            <PaymentOption
              value="card"
              label={t('reception.walkIn.payCard')}
              description={t('reception.walkIn.payCardDesc')}
              selected={paymentMethod === 'card'}
              onSelect={() => setPaymentMethod('card')}
            />
            <PaymentOption
              value="unpaid"
              label={t('reception.walkIn.payLater')}
              description={t('reception.walkIn.payLaterDesc')}
              selected={paymentMethod === 'unpaid'}
              onSelect={() => setPaymentMethod('unpaid')}
            />
          </div>
        </fieldset>
      </div>

      {/* RIGHT: summary */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <h2 className="font-display text-lg text-primary mb-3">{localizedName(room, locale)}</h2>
          <div className="space-y-2 text-body-md">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">{t('reception.walkIn.priceXNights', { price: formatTHB(room.base_price), count: nights })}</span>
              <span className="text-on-surface">{formatTHB(price.baseSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">{t('reception.walkIn.tax')}</span>
              <span className="text-on-surface">{formatTHB(price.taxTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">{t('reception.walkIn.resortFee')}</span>
              <span className="text-on-surface">{formatTHB(price.feeTotal)}</span>
            </div>
          </div>
          <div className="my-4 border-t border-outline-variant" />
          <div className="flex justify-between items-baseline">
            <span className="text-body-md font-bold text-primary">{t('reception.walkIn.grandTotal')}</span>
            <span className="text-2xl font-display font-bold text-primary">{formatTHB(price.total)}</span>
          </div>

          <button
            type="submit"
            disabled={isPending || !!createdBookingId || nights === 0 || !fullName || !email || !phone}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                {t('reception.walkIn.creating')}
              </>
            ) : (
              <>
                <MaterialIcon name="check_circle" size={18} />
                {t('reception.walkIn.confirm')}
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          background: var(--color-surface-container-low);
          border: 1px solid var(--color-outline-variant);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 1rem;
          color: var(--color-on-surface);
          transition: all 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: var(--color-secondary);
          box-shadow: 0 0 0 1px var(--color-secondary);
        }
      `}</style>
    </form>
  )
}

function LockedValue({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <MaterialIcon name={icon} size={18} className="text-on-surface-variant shrink-0" />
      <div>
        <dt className="text-caption text-on-surface-variant">{label}</dt>
        <dd className="text-body-md font-semibold text-on-surface whitespace-nowrap">{value}</dd>
      </div>
    </div>
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

function PaymentOption({
  value,
  label,
  description,
  selected,
  onSelect,
}: {
  value: 'cash' | 'card' | 'unpaid'
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={`flex items-start gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed'
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={selected}
        onChange={onSelect}
        className="mt-1 w-4 h-4 accent-primary"
      />
      <div className="flex flex-col">
        <span className="text-body-md font-semibold text-on-surface">{label}</span>
        <span className="text-body-sm text-on-surface-variant">{description}</span>
      </div>
    </label>
  )
}
