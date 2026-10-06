'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { addDaysLocalIso } from '@/lib/dates'

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
 * Two inline `<input type="date">` fields matching the visual style of
 * the homepage SearchBar (rounded-full, leading calendar icon, label
 * stack). Reuses the `?checkin=&checkout=` URL param convention from
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
    <div className="mt-1 inline-flex items-center gap-2 flex-wrap">
      {/* From-date field (range-neutral label — the active topic is
          chosen by the separate tab control, not by this input). */}
      <label className="relative inline-flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-full pl-3 pr-4 py-1.5 hover:border-secondary focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-colors">
        <MaterialIcon name="calendar_today" size={16} className="text-on-surface-variant shrink-0" />
        <div className="flex flex-col">
          <span className="text-caption text-on-surface-variant font-semibold uppercase tracking-wider leading-none">
            จากวันที่
          </span>
          <input
            type="date"
            value={defaultCheckin}
            onChange={(e) => handleCheckinChange(e.target.value)}
            aria-label="วันเริ่มต้น"
            className="bg-transparent text-body-md text-on-surface focus:outline-none w-32"
          />
        </div>
      </label>

      {/* To-date field (range-neutral label). */}
      <label className="relative inline-flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-full pl-3 pr-4 py-1.5 hover:border-secondary focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-colors">
        <MaterialIcon name="event" size={16} className="text-on-surface-variant shrink-0" />
        <div className="flex flex-col">
          <span className="text-caption text-on-surface-variant font-semibold uppercase tracking-wider leading-none">
            ถึงวันที่
          </span>
          <input
            type="date"
            value={defaultCheckout}
            min={defaultCheckin}
            onChange={(e) => handleCheckoutChange(e.target.value)}
            aria-label="วันสิ้นสุด"
            className="bg-transparent text-body-md text-on-surface focus:outline-none w-32"
          />
        </div>
      </label>

      {(defaultCheckin !== today || defaultCheckout !== today) && (
        <button
          type="button"
          onClick={() => navigate(today, today)}
          className="ml-1 text-caption text-primary font-semibold uppercase tracking-wider px-2 py-1 rounded hover:bg-primary-fixed transition-colors"
        >
          กลับวันนี้
        </button>
      )}
    </div>
  )
}