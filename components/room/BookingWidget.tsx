'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useTransition, useEffect } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { RatingStars } from './RatingStars'
import {
  calculateNights,
  calculatePrice,
  formatTHB,
  type PricingSettings,
} from '@/lib/pricing'
import { getSeasonalRatesAction } from '@/app/actions/seasonal-rates'
import type { AppliedRate, QuoteResult } from '@/lib/pricing/seasons'
import type { RoomType } from '@/lib/data/types'
import { getLocalIsoDate, getTodayLocalIso, getTomorrowLocalIso } from '@/lib/dates'

interface BookingWidgetProps {
  room: RoomType
  /** Phase parity — live tax + resort fee from `getPricingConstants()` */
  settings: PricingSettings
  /** Pre-fill from the /rooms search (lowercase `checkin` URL param). */
  defaultCheckIn?: string
  /** Pre-fill from the /rooms search (lowercase `checkout` URL param). */
  defaultCheckOut?: string
  /** Pre-fill from the /rooms search (`guests` URL param). */
  defaultGuests?: number
}

/** Tomorrow + 1 day (i.e. 2 nights out) — the historical default checkout. */
function getTomorrowPlusOneIso() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return getLocalIsoDate(d)
}

export function BookingWidget({ room, settings, defaultCheckIn, defaultCheckOut, defaultGuests }: BookingWidgetProps) {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState(() => defaultCheckIn ?? getTomorrowLocalIso())
  const [checkOut, setCheckOut] = useState(() => defaultCheckOut ?? getTomorrowPlusOneIso())
  // Clamp initial guests into [1, max_guests] so a stale URL param (e.g.
  // ?guests=10 on a max=4 room) doesn't strand the + button in a
  // permanently-capped state.
  const [guests, setGuests] = useState(() =>
    Math.min(Math.max(1, defaultGuests ?? 2), room.max_guests),
  )

  // Phase parity — capture full QuoteResult so calculatePrice uses the
  // seasonal-aware baseSubtotal. Also drives the appliedRates banner.
  const [appliedRates, setAppliedRates] = useState<AppliedRate[]>([])
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [minNightsBlocked, setMinNightsBlocked] = useState(false)
  const [, startTransition] = useTransition()

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
          guests,
          quote: quote ?? undefined,
        },
        settings,
      ),
    [room.base_price, checkIn, checkOut, guests, quote, settings]
  )

  const handleReserve = () => {
    const params = new URLSearchParams({
      roomId: room.id,
      checkIn,
      checkOut,
      guests: String(guests),
    })
    router.push(`/bookings/new?${params.toString()}`)
  }

  const hasSeasonalRates = appliedRates.length > 0

  return (
    <aside className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) border border-outline-variant p-6 lg:sticky lg:top-24">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <span className="text-caption text-on-surface-variant uppercase tracking-wider">ราคา</span>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold text-primary">{formatTHB(room.base_price)}</span>
            <span className="text-body-md text-on-surface-variant">/ คืน</span>
          </div>
        </div>
        <RatingStars value={room.rating_avg} size={16} showValue={false} />
      </div>

      {/* Date + guest picker */}
      <div className="border border-outline-variant rounded-xl overflow-hidden mb-4">
        <div className="grid grid-cols-2 divide-x divide-outline-variant">
          <label className="block p-3 cursor-pointer hover:bg-primary-fixed transition-colors">
            <span className="text-caption text-on-surface-variant uppercase tracking-wider block">
              เช็คอิน
            </span>
            <input
              type="date"
              value={checkIn}
              min={getTodayLocalIso()}
              onChange={(e) => {
                setCheckIn(e.target.value)
                if (e.target.value >= checkOut) {
                  const next = new Date(e.target.value)
                  next.setDate(next.getDate() + 1)
                  setCheckOut(getLocalIsoDate(next))
                }
              }}
              className="w-full bg-transparent text-body-md font-medium text-on-surface focus:outline-none"
            />
          </label>
          <label className="block p-3 cursor-pointer hover:bg-primary-fixed transition-colors">
            <span className="text-caption text-on-surface-variant uppercase tracking-wider block">
              เช็คเอาท์
            </span>
            <input
              type="date"
              value={checkOut}
              min={checkIn > getTodayLocalIso() ? checkIn : getTodayLocalIso()}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full bg-transparent text-body-md font-medium text-on-surface focus:outline-none"
            />
          </label>
        </div>
        <div className="border-t border-outline-variant p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-caption text-on-surface-variant uppercase tracking-wider block">
                ผู้เข้าพัก
              </span>
              <span className="text-body-md font-medium text-on-surface">
                {guests} ท่าน / สูงสุด {room.max_guests}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGuests((g) => Math.max(1, g - 1))}
                disabled={guests <= 1}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current disabled:hover:border-outline-variant"
                aria-label="ลดจำนวนผู้เข้าพัก"
              >
                <MaterialIcon name="remove" size={16} />
              </button>
              <span className="text-body-md font-semibold w-6 text-center">{guests}</span>
              <button
                type="button"
                onClick={() => setGuests((g) => Math.min(room.max_guests, g + 1))}
                disabled={guests >= room.max_guests}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current disabled:hover:border-outline-variant"
                aria-label="เพิ่มจำนวนผู้เข้าพัก"
              >
                <MaterialIcon name="add" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      {nights > 0 ? (
        <div className="flex flex-col gap-2 mb-4 pb-4 border-b border-outline-variant">
          {hasSeasonalRates && (
            <div className="px-3 py-2 bg-secondary/10 rounded-lg">
              <div className="text-caption uppercase tracking-wider text-on-surface-variant mb-1">
                มีเรทฤดูกาลสำหรับช่วงที่เลือก
              </div>
              <ul className="flex flex-col gap-1">
                {appliedRates.map((r) => (
                  <li key={r.id} className="text-caption text-on-surface">
                    • {r.label} · {r.nights} คืน
                    {r.minNightsOverride != null && (
                      <span className="text-warning ml-1">(ขั้นต่ำ {r.minNightsOverride} คืน)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <PriceRow
            label={`${formatTHB(room.base_price)} × ${nights} คืน`}
            value={formatTHB(price.baseSubtotal)}
          />
          <PriceRow label="ภาษี" value={formatTHB(price.taxTotal)} />
          <PriceRow label="ค่าบริการรีสอร์ท" value={formatTHB(price.feeTotal)} />
        </div>
      ) : (
        <p className="text-body-md text-error mb-4">กรุณาเลือกวันที่ให้ถูกต้อง</p>
      )}

      {minNightsBlocked && (
        <p className="text-body-md text-warning mb-4">
          เรทฤดูกาลกำหนดจำนวนคืนขั้นต่ำมากกว่าที่เลือก — กรุณาเพิ่มจำนวนคืน
        </p>
      )}

      <PriceRow label="รวมทั้งสิ้น" value={formatTHB(price.total)} emphasis />

      <button
        type="button"
        onClick={handleReserve}
        disabled={nights === 0 || minNightsBlocked}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <MaterialIcon name="bookmark" size={18} />
        ยืนยันการจอง
      </button>

      <p className="mt-4 text-caption text-on-surface-variant text-center">
        คุณจะไม่ถูกเรียกเก็บเงินจนกว่าจะยืนยัน
      </p>

      <div className="mt-4 pt-4 border-t border-outline-variant">
        <div className="flex items-center gap-2 text-caption text-on-surface-variant">
          <MaterialIcon name="verified" size={16} className="text-primary" />
          <span>ยกเลิกฟรีภายใน 24 ชั่วโมง</span>
        </div>
      </div>
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
    <div className="flex items-center justify-between">
      <span className={emphasis ? 'text-body-md font-bold text-primary' : 'text-body-md text-on-surface-variant'}>
        {label}
      </span>
      <span className={emphasis ? 'text-body-md font-bold text-primary' : 'text-body-md text-on-surface'}>
        {value}
      </span>
    </div>
  )
}