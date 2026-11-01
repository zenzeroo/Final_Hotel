'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { addDaysLocalIso } from '@/lib/dates'
import { useT } from '@/lib/i18n/useT'

interface CheckInOutDateRangeProps {
  /** Server-validated check-in ISO (YYYY-MM-DD). */
  defaultCheckin: string
  /** Server-validated check-out ISO (YYYY-MM-DD). Always >= checkin. */
  defaultCheckout: string
  /** Server-computed "today" (local TZ) used to omit the params when
   *  navigating back so URLs stay canonical. */
  today: string
}

/**
 * Phase 48b — check-in / check-out date range picker for
 * /reception/check-in-out.
 *
 * Two inline `<input type="date">` fields (white rounded box, leading
 * calendar icon, small label above the date). Reuses the
 * `?checkin=&checkout=` URL param convention from
 * SearchBar so reception can deep-link the same dates the customer
 * search flow uses.
 *
 * Self-correct: if the user picks a check-out earlier than check-in,
 * the check-out is bumped to check-in + 1 (mirror of SearchBar's
 * `handleCheckinChange` clamp at SearchBar.tsx:124-138).
 *
 * Navigation: in-place `router.replace` with `{ scroll: false }` so the
 * page re-renders without a scroll-to-top jump and without polluting
 * browser history. When both fields equal today, both params are
 * removed so the URL stays canonical (no `?checkin=today&checkout=today`).
 */
export function CheckInOutDateRange({
  defaultCheckin,
  defaultCheckout,
  today,
}: CheckInOutDateRangeProps) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(nextCheckin: string, nextCheckout: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextCheckin === today) params.delete('checkin')
    else params.set('checkin', nextCheckin)
    if (nextCheckout === today) params.delete('checkout')
    else params.set('checkout', nextCheckout)
    const qs = params.toString()
    const target = qs ? `${pathname}?${qs}` : pathname
    router.replace(target, { scroll: false })
  }

  function handleCheckinChange(v: string) {
    if (!v) return
    // If the new check-in lands after the current check-out, bump
    // check-out to check-in + 1 to keep the range valid.
    const nextCheckout = v >= defaultCheckout ? addDaysLocalIso(v, 1) : defaultCheckout
    navigate(v, nextCheckout)
  }

  function handleCheckoutChange(v: string) {
    if (!v) return
    navigate(defaultCheckin, v)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* From-date field (range-neutral label — the active topic is
          chosen by the separate tab control, not by this input). */}
      <label className="relative inline-flex items-center gap-2 min-h-11 bg-surface-container-lowest border border-transparent rounded-xl pl-3 pr-4 py-1.5 hover:border-outline-variant focus-within:border-secondary transition-colors">
        <MaterialIcon name="calendar_today" size={16} className="text-on-surface-variant shrink-0" />
        <div className="flex flex-col">
          <span className="text-[13px] text-on-surface-variant leading-none">
            {t('reception.common.from')}
          </span>
          <input
            type="date"
            value={defaultCheckin}
            onChange={(e) => handleCheckinChange(e.target.value)}
            aria-label={t('reception.common.fromAria')}
            className="bg-transparent text-body-md text-on-surface focus:outline-none w-32 tabular-nums"
          />
        </div>
      </label>

      {/* To-date field (range-neutral label). */}
      <label className="relative inline-flex items-center gap-2 min-h-11 bg-surface-container-lowest border border-transparent rounded-xl pl-3 pr-4 py-1.5 hover:border-outline-variant focus-within:border-secondary transition-colors">
        <MaterialIcon name="event" size={16} className="text-on-surface-variant shrink-0" />
        <div className="flex flex-col">
          <span className="text-[13px] text-on-surface-variant leading-none">
            {t('reception.common.to')}
          </span>
          <input
            type="date"
            value={defaultCheckout}
            min={defaultCheckin}
            onChange={(e) => handleCheckoutChange(e.target.value)}
            aria-label={t('reception.common.toAria')}
            className="bg-transparent text-body-md text-on-surface focus:outline-none w-32 tabular-nums"
          />
        </div>
      </label>

      {(defaultCheckin !== today || defaultCheckout !== today) && (
        <button
          type="button"
          onClick={() => navigate(today, today)}
          className="min-h-11 px-3 text-[14px] text-primary font-semibold rounded-lg underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-secondary"
        >
          {t('reception.checkInOutPage.backToToday')}
        </button>
      )}
    </div>
  )
}