'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, type FormEvent } from 'react'
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
  /**
   * Where ค้นหา navigates. Defaults to '/rooms'. Reused by
   * `/reception/bookings/new` (Phase 45) which passes
   * navigateTo='/reception/bookings/new' so searches stay on the picker
   * page instead of jumping to /rooms.
   */
  navigateTo?: string
  /**
   * Compact-only — whether to render the "รีเซ็ต" button (keeps the dates,
   * drops guests + sidebar filters). Set false for pages without those
   * filters (e.g. walk-in picker).
   */
  showReset?: boolean
}

const DEFAULT_GUESTS = 2

export function SearchBar({
  variant = 'hero',
  defaultCheckin,
  defaultCheckout,
  defaultGuests = DEFAULT_GUESTS,
  navigateTo = '/rooms',
  showReset = true,
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

  // Inputs only change local state — nothing navigates until the user
  // presses ค้นหา (or รีเซ็ต on compact).
  function handleCheckinChange(v: string) {
    setCheckin(v)
    // If the new check-in lands on/after the current checkout, bump
    // checkout to check-in + 1.
    if (v >= checkout) setCheckout(addDaysLocalIso(v, 1))
  }

  function handleGuestsChange(delta: number) {
    setGuests((g) => Math.max(1, Math.min(10, g + delta)))
  }

  /**
   * Submit → `navigateTo` (default '/rooms'). Already on that page (/rooms,
   * walk-in picker): keep the other filters and replace in place. Elsewhere
   * (homepage hero): start from a clean query and push.
   */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const isOnTargetPage = pathname === navigateTo
    const params = new URLSearchParams(
      isOnTargetPage ? searchParams.toString() : '',
    )
    params.set('checkin', checkin)
    params.set('checkout', checkout)
    params.set('guests', String(guests))
    const target = `${navigateTo}?${params.toString()}`
    if (isOnTargetPage) router.replace(target, { scroll: false })
    else router.push(target, { scroll: false })
  }

  // Compact-only: "รีเซ็ต" — keep the chosen dates, drop guests and every
  // sidebar filter (type/floor/priceRange) so the page lists all rooms
  // available for those dates. Without a `guests` param /rooms skips the
  // capacity filter.
  function handleReset() {
    setGuests(DEFAULT_GUESTS)
    const params = new URLSearchParams({ checkin, checkout })
    router.replace(`${navigateTo}?${params.toString()}`, { scroll: false })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col md:flex-row items-stretch gap-3 md:gap-2 bg-surface-container-lowest p-4 md:p-3 rounded-2xl shadow-(--shadow-ambient-lg) md:rounded-full"
    >
      {/* Check-in */}
      <DateField
        label={t('roomsList.searchBar.checkIn')}
        value={checkin}
        min={getMinCheckInLocalIso()}
        onChange={handleCheckinChange}
      />

      {/* Check-out */}
      <DateField
        label={t('roomsList.searchBar.checkOut')}
        value={checkout}
        min={addDaysLocalIso(checkin, 1)}
        onChange={setCheckout}
      />

      {/* Guests */}
      <div className="flex-1 flex items-center gap-3 px-4 md:py-2 md:border-l md:border-outline-variant">
        <span className="text-label-md text-on-surface-variant shrink-0">{t('roomsList.searchBar.guests')}</span>
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={() => handleGuestsChange(-1)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
            aria-label={t('roomsList.searchBar.decGuests')}
          >
            <MaterialIcon name="remove" size={16} />
          </button>
          <span className="text-body-md font-semibold w-6 text-center">{guests}</span>
          <button
            type="button"
            onClick={() => handleGuestsChange(+1)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
            aria-label={t('roomsList.searchBar.incGuests')}
          >
            <MaterialIcon name="add" size={16} />
          </button>
        </div>
      </div>

      {/* Actions — Submit everywhere; compact adds "รีเซ็ต" (unless showReset=false). */}
      {variant === 'compact' && showReset && (
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center justify-center gap-1 md:rounded-full px-5 py-3 md:py-2 rounded-xl border border-primary text-primary font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:border-primary-fixed transition-colors"
        >
          <MaterialIcon name="restart_alt" size={20} />
          <span>{t('roomsList.searchBar.reset')}</span>
        </button>
      )}
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-1 md:rounded-full bg-primary text-on-primary px-6 py-3 md:py-2 rounded-xl font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
      >
        <MaterialIcon name="search" size={20} />
        <span>{t('roomsList.searchBar.search')}</span>
      </button>
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
