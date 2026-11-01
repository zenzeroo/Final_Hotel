'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useMemo, useTransition, useEffect } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { RatingStars } from './RatingStars'
import { ConfirmModal } from '../ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'
import {
  calculateNights,
  calculatePrice,
  formatTHB,
  type PricingSettings,
} from '@/lib/pricing'
import { getSeasonalRatesAction } from '@/app/actions/seasonal-rates'
import { createTempBookingAction } from '@/app/actions/booking'
import type { AppliedRate, QuoteResult } from '@/lib/pricing/seasons'
import type { RoomType } from '@/lib/data/types'
import { getLocalIsoDate, getMinCheckInLocalIso, addDaysLocalIso } from '@/lib/dates'
import { isRefundable } from '@/lib/refund-rule'
import { DatePickerField } from '../ui/DatePickerField'

interface BookingWidgetProps {
  room: RoomType
  /** Phase parity — live tax + resort fee from `getPricingConstants()` */
  settings: PricingSettings
  /** Pre-fill from the /rooms search (lowercase `checkin` URL param). */
  defaultCheckIn?: string
  /** Pre-fill from the /rooms search (lowercase `checkout` URL param). */
  defaultCheckOut?: string
  /**
   * Server-derived auth state. When `false`, clicking "ยืนยันการจอง"
   * opens a login prompt modal that preserves the user's date selection
   * on dismiss and forwards a return URL on confirm. When `true`,
   * navigates straight to /bookings/new as before.
   */
  isAuthed: boolean
  /** Phase 57c — refund_min_days_before_checkin() from the DB. */
  refundMinDays: number
}

/** Tomorrow + 1 day (i.e. 2 nights out) — the historical default checkout. */
function getTomorrowPlusOneIso() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return getLocalIsoDate(d)
}

export function BookingWidget({ room, settings, defaultCheckIn, defaultCheckOut, isAuthed, refundMinDays }: BookingWidgetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useT()
  // Hotels require ≥ 1 day advance booking — clamp URL-provided checkIn
  // so a stale `?checkIn=2026-09-08` link (today) doesn't strand the user.
  const [checkIn, setCheckIn] = useState(() => {
    const min = getMinCheckInLocalIso()
    return defaultCheckIn && defaultCheckIn >= min ? defaultCheckIn : min
  })
  const [checkOut, setCheckOut] = useState(() => defaultCheckOut ?? getTomorrowPlusOneIso())
  // Logged-out users clicking "ยืนยันการจอง" see a confirmation modal
  // instead of being redirected straight to /login. State is local to
  // the modal — dismissing it leaves the dates widget state untouched.
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // Phase 42 — inline error from createTempBookingAction (replaces the
  // pre-Phase-42 redirect-with-search-params flow that had no error path).
  const [reserveError, setReserveError] = useState<string | null>(null)

  // Phase parity — capture full QuoteResult so calculatePrice uses the
  // seasonal-aware baseSubtotal. Also drives the appliedRates banner.
  const [appliedRates, setAppliedRates] = useState<AppliedRate[]>([])
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [minNightsBlocked, setMinNightsBlocked] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (checkIn >= checkOut) return
    startTransition(async () => {
      const res = await getSeasonalRatesAction({
        roomTypeId: room.id,
        checkIn,
        checkOut,
        basePrice: room.base_price,
      })
      if (res.ok && res.quote) {
        setAppliedRates(res.quote.appliedRates)
        setQuote(res.quote)
        setMinNightsBlocked(Boolean(res.violatesMinNights))
      } else {
        setAppliedRates([])
        setQuote(null)
        setMinNightsBlocked(false)
      }
    })
  }, [checkIn, checkOut, room.id, room.base_price])

  const nights = useMemo(() => calculateNights(checkIn, checkOut), [checkIn, checkOut])

  // Phase parity — pass `quote` + `settings` so widget preview matches
  // `/bookings/new`. Quote drives baseSubtotal; settings drive tax + fee.
  // createBooking re-computes authoritatively server-side.
  const price = useMemo(
    () =>
      calculatePrice(
        {
          basePrice: room.base_price,
          checkIn,
          checkOut,
          quote: quote ?? undefined,
        },
        settings,
      ),
    [room.base_price, checkIn, checkOut, quote, settings]
  )

  const handleReserve = () => {
    if (!isAuthed) {
      setShowLoginPrompt(true)
      return
    }
    setReserveError(null)
    startTransition(async () => {
      const result = await createTempBookingAction({
        roomTypeId: room.id,
        checkIn,
        checkOut,
        // Guest count is fixed to the room's max capacity — pricing doesn't
        // vary by guest count in this project (see lib/pricing.ts:18 — the
        // `guests` field is reserved for future guest-based pricing but is
        // not currently read by `calculatePrice`). completeTempBookingAction
        // re-reads max_guests at server-side anyway as defense-in-depth.
        guests: room.max_guests,
      })
      if (!result.ok || !result.bookingId) {
        setReserveError(result.error ?? t('rooms.tempBookingError'))
        return
      }
      router.push(`/bookings/new?bookingId=${result.bookingId}`)
    })
  }

  /**
   * Build the post-login return URL from the user's current location
   * (pathname + searchParams) so they land back on this room page with
   * their date selections preserved. encodeURIComponent handles the `?`,
   * `&`, `=` inside the value. signIn action runs sanitizeNext() which
   * rejects open-redirect attempts.
   */
  function handleLoginClick() {
    const qs = searchParams.toString()
    const next = qs ? `${pathname}?${qs}` : pathname
    router.push(`/login?next=${encodeURIComponent(next)}`)
    setShowLoginPrompt(false)
  }

  const hasSeasonalRates = appliedRates.length > 0

  return (
    <aside className="bg-surface-container-low p-6 md:p-8 lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <span className="text-[14px] text-on-surface-variant">{t('customer.widget.price')}</span>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-bold text-primary">{formatTHB(room.base_price)}</span>
            <span className="text-body-md text-on-surface-variant">{t('customer.roomCard.perNight')}</span>
          </div>
        </div>
        <RatingStars value={room.rating_avg} count={room.rating_count} size={16} showValue={false} />
      </div>

      {/* Date + guest picker */}
      <div className="flex flex-col gap-px bg-surface-container mb-6">
        <div className="grid grid-cols-2 gap-px">
          <div className="bg-surface-container-lowest hover:bg-primary-fixed transition-colors">
            <DatePickerField
              label={t('customer.common.checkIn')}
              iconName=""
              value={checkIn}
              min={getMinCheckInLocalIso()}
              onChange={(v) => {
                setCheckIn(v)
                if (v >= checkOut) {
                  const next = new Date(v)
                  next.setDate(next.getDate() + 1)
                  setCheckOut(getLocalIsoDate(next))
                }
              }}
            />
          </div>
          <div className="bg-surface-container-lowest hover:bg-primary-fixed transition-colors">
            <DatePickerField
              label={t('customer.common.checkOut')}
              iconName=""
              value={checkOut}
              min={addDaysLocalIso(checkIn, 1)}
              onChange={(v) => setCheckOut(v)}
            />
          </div>
        </div>
        <div className="bg-surface-container-lowest p-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-on-surface-variant">
              {t('customer.common.guestsLabel')}
            </span>
            <span className="text-body-md font-medium text-on-surface ml-auto">
              {t('customer.widget.maxGuests', { count: room.max_guests })}
            </span>
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      {nights > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          {hasSeasonalRates && (
            <div className="px-3 py-2 bg-secondary-container/50">
              <div className="text-[14px] text-on-surface mb-1">
                {t('customer.widget.seasonalTitle')}
              </div>
              <ul className="flex flex-col gap-1">
                {appliedRates.map((r) => (
                  <li key={r.id} className="text-[14px] text-on-surface">
                    {t('customer.common.seasonalLine', { label: r.label, nights: r.nights })}
                    {r.minNightsOverride != null && (
                      <span className="text-warning ml-1">({t('customer.common.minNights', { count: r.minNightsOverride })})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <PriceRow
            label={t('customer.common.priceTimesNights', { price: formatTHB(room.base_price), nights })}
            value={formatTHB(price.baseSubtotal)}
          />
          <PriceRow label={t('customer.common.tax')} value={formatTHB(price.taxTotal)} />
          <PriceRow label={t('customer.common.resortFee')} value={formatTHB(price.feeTotal)} />
        </div>
      ) : (
        <p className="text-body-md text-error mb-4">{t('customer.widget.invalidDates')}</p>
      )}

      {minNightsBlocked && (
        <p className="text-body-md text-warning mb-4">
          {t('customer.widget.minNightsError')}
        </p>
      )}

      <PriceRow label={t('customer.common.total')} value={formatTHB(price.total)} emphasis />

      {reserveError && (
        <div
          role="alert"
          className="mt-4 px-4 py-3 bg-error-container text-body-md text-on-error-container"
        >
          {reserveError}
        </div>
      )}

      <button
        type="button"
        onClick={handleReserve}
        disabled={nights === 0 || minNightsBlocked || isPending}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 h-12 px-6 bg-primary text-on-primary font-semibold text-body-md hover:bg-primary-container active:translate-y-px transition-[background-color,transform] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        {isPending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            {t('bookings.creatingHold')}
          </>
        ) : (
          <>
            {t('customer.widget.confirm')}
          </>
        )}
      </button>

      <p className="mt-3 text-[14px] text-on-surface-variant text-center">
        {t('customer.widget.noCharge')}
      </p>

      <div className="mt-6 flex flex-col gap-1.5">
        {/* Phase 57c/d — refund rule always; a warning when the picked dates are too close */}
        <div className="flex items-center gap-2 text-[14px] text-on-surface">
          <MaterialIcon name="verified" size={16} className="text-primary" />
          <span>{t('customer.widget.refundRule', { min: refundMinDays })}</span>
        </div>
        {checkIn && !isRefundable(checkIn, refundMinDays) && (
          <div className="flex items-center gap-2 text-[14px] text-error">
            <MaterialIcon name="info" size={16} />
            <span>{t('customer.widget.refundNone')}</span>
          </div>
        )}
      </div>

      {/* Login prompt — shown when logged-out user clicks "ยืนยันการจอง".
          Dismissing leaves the user's date selections intact; confirming
          sends them to /login with a return URL back to this exact page
          (including current ?checkin / ?checkout / ?guests params). */}
      <ConfirmModal
        open={showLoginPrompt}
        onCancel={() => setShowLoginPrompt(false)}
        onConfirm={handleLoginClick}
        title={t('roomDetail.loginToBook.title')}
        body={t('roomDetail.loginToBook.body')}
        cancelLabel={t('roomDetail.loginToBook.continueViewing')}
        okLabel={t('roomDetail.loginToBook.goToLogin')}
      />
    </aside>
  )
}

function PriceRow({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className={`flex justify-between ${emphasis ? 'items-baseline pt-4' : 'items-center'}`}>
      <span className={emphasis ? 'text-body-md font-semibold text-primary' : 'text-body-md text-on-surface'}>
        {label}
      </span>
      <span className={emphasis ? 'font-display text-[32px] leading-none font-bold text-primary' : 'text-body-md text-on-surface tabular-nums'}>
        {value}
      </span>
    </div>
  )
}