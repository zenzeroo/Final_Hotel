'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import {
  getMinCheckInLocalIso,
  addDaysLocalIso,
} from '@/lib/dates'
import { useT } from '@/lib/i18n/useT'

interface SearchBarProps {
  variant?: 'hero' | 'compact'
  defaultCheckin?: string
  defaultCheckout?: string
  defaultGuests?: number
}

export function SearchBar({
  variant = 'hero',
  defaultCheckin,
  defaultCheckout,
  defaultGuests = 2,
}: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const t = useT()

  // Hotels require ≥ 1 day of advance booking. Clamp any URL-provided
  // checkin to the policy minimum so an out-of-date shared link can't
  // strand the user on a same-day check-in that the backend would reject.
  const [checkin, setCheckin] = useState(() => {
    const min = getMinCheckInLocalIso()
    return defaultCheckin && defaultCheckin >= min ? defaultCheckin : min
  })
  const [checkout, setCheckout] = useState(() => {
    const base = defaultCheckin ?? getMinCheckInLocalIso()
    const proposed = defaultCheckout ?? addDaysLocalIso(base, 1)
    // Ensure checkout is at least 1 day after the (possibly-clamped) checkin.
    const minCheckout = addDaysLocalIso(base, 1)
    return proposed >= minCheckout ? proposed : minCheckout
  })
  const [guests, setGuests] = useState(defaultGuests)

  const isHero = variant === 'hero'
  const isCompact = variant === 'compact'

  /**
   * Navigation strategy:
   * - `compact`  (/rooms list) → in-place URL update via router.replace.
   * - `hero`     (homepage hero on /) → requires explicit Submit.
   */
  const isOnRooms = pathname === '/rooms'

  function navigateToRooms(opts: {
    checkin?: string
    checkout?: string
    guests?: number
  }) {
    // Compact renders only on /rooms, so we always replace (not push)
    // and always merge with existing searchParams to preserve unrelated
    // filters (type, floor, priceRange, viewAll).
    const params = new URLSearchParams(
      isOnRooms ? searchParams.toString() : '',
    )
    if (opts.checkin !== undefined) {
      if (opts.checkin) params.set('checkin', opts.checkin)
      else params.delete('checkin')
    }
    if (opts.checkout !== undefined) {
      if (opts.checkout) params.set('checkout', opts.checkout)
      else params.delete('checkout')
    }
    if (opts.guests !== undefined) {
      if (opts.guests) params.set('guests', String(opts.guests))
      else params.delete('guests')
    }
    const qs = params.toString()

    // In-place URL update — keeps history clean + scroll position.
    router.replace(`/rooms${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  // ─────────────────────────────────────────────────────────────────
  // Realtime auto-navigate (compact)
  // ─────────────────────────────────────────────────────────────────
  // Compact uses a 350ms debounce for guests +/- clicks so rapid bursts
  // coalesce into one navigation, not 4-5 back-to-back.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────
  function handleCheckinChange(v: string) {
    setCheckin(v)
    let nextCheckout = checkout
    // If the new check-in lands on/after the current checkout, bump
    // checkout to check-in + 1 (read post-bump value for navigation).
    if (v >= checkout) {
      nextCheckout = addDaysLocalIso(v, 1)
      setCheckout(nextCheckout)
    }

    if (isCompact) {
      navigateToRooms({ checkin: v, checkout: nextCheckout })
    }
    // hero: no-op — user must Submit
  }

  function handleCheckoutChange(v: string) {
    setCheckout(v)

    if (isCompact) {
      navigateToRooms({ checkout: v })
    }
    // hero: no-op
  }

  function handleGuestsChange(delta: number) {
    const next = Math.max(1, Math.min(10, guests + delta))
    setGuests(next)

    if (isCompact) {
      // Original compact behavior: realtime but with 350ms debounce for the
      // guests +/- clicks. Keep that exact timing on /rooms.
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        navigateToRooms({ guests: next })
      }, 350)
    }
    // hero: no-op
  }

  // Compact-only: "ดูทั้งหมด" — keep guests in URL so RoomCard's
  // `buildRoomHref()` (components/room/RoomCard.tsx:96) forwards
  // checkin/checkout/guests onto /rooms/[slug], letting the
  // BookingWidget there prefill from them. `viewAll=1` signals the
  // /rooms page to skip the `max_guests >= guests` filter — show every
  // available room for the date range regardless of capacity.
  function handleSeeAll() {
    if (!isCompact) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('viewAll', '1')
    if (checkin) params.set('checkin', checkin)
    else params.delete('checkin')
    if (checkout) params.set('checkout', checkout)
    else params.delete('checkout')
    const qs = params.toString()
    router.replace(`/rooms${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // Hero (legacy): explicit Submit required. Use push so the user's
    // history reflects the navigation away from the homepage.
    const params = new URLSearchParams('')
    if (checkin) params.set('checkin', checkin)
    if (checkout) params.set('checkout', checkout)
    if (guests) params.set('guests', String(guests))
    const qs = params.toString()
    router.push(`/rooms${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col md:flex-row items-stretch gap-3 md:gap-2 ${
        isHero
          ? 'bg-surface-container-lowest p-4 md:p-3 rounded-2xl shadow-(--shadow-ambient-lg) md:rounded-full'
          : 'bg-surface-container-lowest p-4 rounded-2xl shadow-(--shadow-ambient)'
      }`}
    >
      {/* Check-in */}
      <DateField
        label="เช็คอิน"
        value={checkin}
        min={getMinCheckInLocalIso()}
        onChange={handleCheckinChange}
      />

      {/* Check-out */}
      <DateField
        label="เช็คเอาท์"
        value={checkout}
        min={addDaysLocalIso(checkin, 1)}
        onChange={handleCheckoutChange}
      />

      {/* Guests */}
      <div
        className={`flex-1 flex items-center gap-3 ${
          isHero
            ? 'md:px-4 md:py-2 md:border-l md:border-outline-variant'
            : 'px-4 py-3 border border-outline-variant rounded-xl'
        }`}
      >
        <span className="text-label-md text-on-surface-variant shrink-0">ผู้เข้าพัก</span>
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={() => handleGuestsChange(-1)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
            aria-label="ลดจำนวนผู้เข้าพัก"
          >
            <MaterialIcon name="remove" size={16} />
          </button>
          <span className="text-body-md font-semibold w-6 text-center">{guests}</span>
          <button
            type="button"
            onClick={() => handleGuestsChange(+1)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
            aria-label="เพิ่มจำนวนผู้เข้าพัก"
          >
            <MaterialIcon name="add" size={16} />
          </button>
        </div>
      </div>

      {/* Actions — compact: "ดูทั้งหมด" button. Hero: Submit button. */}
      {isCompact ? (
        <button
          type="button"
          onClick={handleSeeAll}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-primary text-primary font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
        >
          <MaterialIcon name="grid_view" size={18} />
          <span>{t('roomsList.seeAll')}</span>
        </button>
      ) : isHero ? (
        <button
          type="submit"
          className="md:rounded-full bg-primary text-on-primary px-6 py-3 md:py-2 rounded-xl font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
        >
          <MaterialIcon name="search" size={20} />
          <span>ค้นหาห้องพัก</span>
        </button>
      ) : null}
    </form>
  )
}

function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: string
  min: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex-1 flex items-center gap-3 px-4 py-3">
      <MaterialIcon
        name="calendar_today"
        size={20}
        className="text-on-surface-variant shrink-0"
      />
      <div className="flex flex-col">
        <span className="text-caption text-on-surface-variant font-semibold uppercase tracking-wider">
          {label}
        </span>
        <input
          type="date"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-body-md font-medium text-on-surface focus:outline-none"
        />
      </div>
    </label>
  )
}
