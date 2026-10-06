'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export type CheckInOutTopic = 'checkin' | 'checkout'

interface CheckInOutTopicTabsProps {
  /** Server-resolved active tab (URL ?tab= or default 'checkin'). */
  active: CheckInOutTopic
  /**
   * Server-computed "today" + current checkin/checkout — passed in so
   * the tab can build URL hrefs that preserve the date range. The tab
   * is intentionally independent of the date range: switching tabs
   * does NOT change the range.
   */
  today: string
  checkin: string
  checkout: string
}

/**
 * Phase 48c — topic selector for /reception/check-in-out. Picks which
 * event the user wants to look at (check-in or check-out) as its own
 * control, separate from the date range picker.
 *
 * State coupling: tab and date range are independent. Switching tabs
 * preserves `?checkin=&checkout=`; switching the date range preserves
 * `?tab=`. This matches the user-facing spec ("switching the tab does
 * NOT reset or change the selected date range").
 *
 * URL canonicality: `tab=checkin` (the default) is omitted from the
 * URL. Only `tab=checkout` is ever present so the canonical URL stays
 * `/check-in-out` when the checkin tab is active.
 */
export function CheckInOutTopicTabs({
  active,
  today,
  checkin,
  checkout,
}: CheckInOutTopicTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(next: CheckInOutTopic) {
    const params = new URLSearchParams(searchParams.toString())
    // Omit defaults to keep URL canonical — `tab=checkin` and today's
    // date are not written. Only `tab=checkout` is ever present.
    if (next === 'checkin') params.delete('tab')
    else params.set('tab', 'checkout')
    if (checkin === today) params.delete('checkin')
    else params.set('checkin', checkin)
    if (checkout === today) params.delete('checkout')
    else params.set('checkout', checkout)
    const qs = params.toString()
    const target = qs ? `${pathname}?${qs}` : pathname
    // In-place update — no history push, no scroll jump. Same pattern
    // as CheckInOutDateRange.
    router.replace(target, { scroll: false })
  }

  return (
    <div className="mt-3 inline-flex items-center gap-1 p-1 bg-surface-container rounded-full">
      <button
        type="button"
        onClick={() => navigate('checkin')}
        aria-pressed={active === 'checkin'}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-label-md font-semibold uppercase tracking-wider transition-colors ${
          active === 'checkin'
            ? 'bg-primary text-on-primary'
            : 'text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
        }`}
      >
        <MaterialIcon name="login" size={16} />
        เช็คอิน
      </button>
      <button
        type="button"
        onClick={() => navigate('checkout')}
        aria-pressed={active === 'checkout'}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-label-md font-semibold uppercase tracking-wider transition-colors ${
          active === 'checkout'
            ? 'bg-primary text-on-primary'
            : 'text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
        }`}
      >
        <MaterialIcon name="logout" size={16} />
        เช็คเอาท์
      </button>
    </div>
  )
}