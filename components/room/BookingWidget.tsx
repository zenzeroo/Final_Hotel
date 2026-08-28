'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useTransition, useEffect } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { RatingStars } from './RatingStars'
import { calculateNights, calculatePrice, formatTHB } from '@/lib/pricing'
import { getSeasonalRatesAction } from '@/app/actions/seasonal-rates'
import type { AppliedRate } from '@/lib/pricing/seasons'
import type { RoomType } from '@/lib/data/types'

interface BookingWidgetProps {
  room: RoomType
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10)
}

function getTomorrowIso() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function BookingWidget({ room }: BookingWidgetProps) {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState(getTomorrowIso)
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().slice(0, 10)
  })
  const [guests, setGuests] = useState(2)

  // Phase 8 — seasonal rates fetched server-side whenever dates change.
  const [appliedRates, setAppliedRates] = useState<AppliedRate[]>([])
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
        setMinNightsBlocked(Boolean(res.violatesMinNights))
      } else {
        setAppliedRates([])
        setMinNightsBlocked(false)
      }
    })
  }, [checkIn, checkOut, room.id, room.base_price])

  const nights = useMemo(() => calculateNights(checkIn, checkOut), [checkIn, checkOut])

  // Phase 8 — when seasonal rates apply, baseSubtotal comes from the quote.
  // We use calculatePrice without `quote` here (legacy formula) for the
  // widget preview; createBooking re-computes the authoritative quote server-side.
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
          <label className="block p-3 cursor-pointer hover:bg-surface-container-low transition-colors">
            <span className="text-caption text-on-surface-variant uppercase tracking-wider block">
              เช็คอิน
            </span>
            <input
              type="date"
              value={checkIn}
              min={getTodayIso()}
              onChange={(e) => {
                setCheckIn(e.target.value)
                if (e.target.value >= checkOut) {
                  const next = new Date(e.target.value)
                  next.setDate(next.getDate() + 1)
                  setCheckOut(next.toISOString().slice(0, 10))
                }
              }}
              className="w-full bg-transparent text-body-md font-medium text-on-surface focus:outline-none"
            />
          </label>
          <label className="block p-3 cursor-pointer hover:bg-surface-container-low transition-colors">
            <span className="text-caption text-on-surface-variant uppercase tracking-wider block">
              เช็คเอาท์
            </span>
            <input
              type="date"
              value={checkOut}
              min={checkIn > getTodayIso() ? checkIn : getTodayIso()}
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
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-surface-container transition-colors"
                aria-label="ลดจำนวนผู้เข้าพัก"
              >
                <MaterialIcon name="remove" size={16} />
              </button>
              <span className="text-body-md font-semibold w-6 text-center">{guests}</span>
              <button
                type="button"
                onClick={() => setGuests((g) => Math.min(room.max_guests, g + 1))}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-surface-container transition-colors"
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
        className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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