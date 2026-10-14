'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDateRangeCompact } from '@/lib/dates'

export type CheckInOutView = 'today' | 'upcoming' | 'inhouse'

interface CheckInOutViewTabsProps {
  /** Server-resolved active view (URL ?view= or default 'today'). */
  active: CheckInOutView
  /**
   * Counts shown inside each tab pill. Refreshed by the server component
   * on each navigation so the badges reflect the current filters:
   *   - `today`  : count of bookings matching the active tab (เช็คอิน /
   *                เช็คเอาท์) + date range
   *   - `upcoming`: count of upcoming events matching the active tab
   *                 direction (check-in OR check-out)
   *   - `inhouse`: count of guests currently checked in
   *
   * Always-live for `inhouse` regardless of view/topic/range.
   */
  counts: {
    today: number
    upcoming: number
    inhouse: number
  }
  /**
   * URL-preserving params — passed in so the tab can build hrefs that
   * preserve the topic toggle + date range. The view tab is
   * intentionally independent of both: switching tabs does NOT reset
   * the topic or the date range.
   */
  today: string
  checkin: string
  checkout: string
  activeTab: 'checkin' | 'checkout'
}

/**
 * Phase 48f — view selector for /reception/check-in-out.
 *
 * Three tabs: "วันนี้" / "กำลังจะมา" / "พักอยู่ในขณะนี้" — each with a
 * count badge and a Material Symbol icon.
 *
 * The first tab's label is dynamic: when the selected date range is
 * exactly today it shows "วันนี้"; for any other range (single-day
 * non-today or multi-day window) it shows a compact date string from
 * `formatDateRangeCompact` so it never misleadingly says "วันนี้" while
 * displaying non-today data.
 *
 * Visual style (Phase 48f): underline + light-bg active state, ghost
 * inactive. Distinct from the topic toggle above (which keeps the bold
 * dark-green pill style as a "mode" control) so the two rows read as
 * different layers of the UI — mode above, view above.
 *
 * State independence: view, topic, and date range are all independent.
 * Switching view preserves the others (mirrors Phase 48c).
 *
 * URL canonicality: `?view=today` (the default) is omitted from the URL.
 * Only `?view=upcoming` or `?view=inhouse` is ever present.
 */
export function CheckInOutViewTabs({
  active,
  counts,
  today,
  checkin,
  checkout,
  activeTab,
}: CheckInOutViewTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(next: CheckInOutView) {
    const params = new URLSearchParams(searchParams.toString())
    // Omit defaults to keep URL canonical — `view=today` and the
    // default topic (`tab=checkin`) and today's date are not written.
    if (next === 'today') params.delete('view')
    else params.set('view', next)
    if (activeTab === 'checkin') params.delete('tab')
    else params.set('tab', 'checkout')
    if (checkin === today) params.delete('checkin')
    else params.set('checkin', checkin)
    if (checkout === today) params.delete('checkout')
    else params.set('checkout', checkout)
    const qs = params.toString()
    const target = qs ? `${pathname}?${qs}` : pathname
    // In-place update — no history push, no scroll jump. Same
    // pattern as CheckInOutTopicTabs + CheckInOutDateRange.
    router.replace(target, { scroll: false })
  }

  // Phase 48f — dynamic first-tab label. "วันนี้" only when the range
  // is exactly today's single day; otherwise show a compact range
  // string so the label never lies about what's being shown.
  const isTodayRange = checkin === today && checkout === today
  const todayLabel = isTodayRange ? 'วันนี้' : formatDateRangeCompact(checkin, checkout)

  // Active-state style: underline + light surface background.
  // The border-b-2 + negative margin aligns the underline with the
  // container's border-b (the tab row's bottom rule) so the active
  // underline looks like a single continuous line.
  const baseTab =
    'inline-flex items-center gap-2 px-4 py-2 -mb-px text-label-md font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap'
  const activeClass = 'border-primary text-primary bg-surface-container'
  const inactiveClass = 'border-transparent text-on-surface-variant hover:bg-surface-container hover:text-primary'

  return (
    // Phase 48f defense-in-depth — `suppressHydrationWarning` on the
    // tablist wrapper. The className itself is fully deterministic
    // (static string, no client-only branches) — this attribute is a
    // safety net for the rare case where a stale `.next/build` artifact
    // (e.g. from a previous `npm run build`) ships the older pill-style
    // className to the client while SSR serves the current underline
    // style. The wrapper has no interactive content, so suppressing
    // the warning here is safe — child buttons (with their own
    // className driven by props) hydrate normally.
    <div
      role="tablist"
      aria-label="View selector"
      className="mt-4 flex items-center gap-1 border-b border-outline-variant overflow-x-auto"
      suppressHydrationWarning
    >
      <button
        type="button"
        role="tab"
        onClick={() => navigate('today')}
        aria-selected={active === 'today'}
        className={`${baseTab} ${active === 'today' ? activeClass : inactiveClass}`}
      >
        <MaterialIcon
          name={activeTab === 'checkin' ? 'login' : 'logout'}
          size={16}
        />
        {todayLabel} ({counts.today})
      </button>
      <button
        type="button"
        role="tab"
        onClick={() => navigate('upcoming')}
        aria-selected={active === 'upcoming'}
        className={`${baseTab} ${active === 'upcoming' ? activeClass : inactiveClass}`}
      >
        <MaterialIcon name="schedule" size={16} />
        กำลังจะมา ({counts.upcoming})
      </button>
      <button
        type="button"
        role="tab"
        onClick={() => navigate('inhouse')}
        aria-selected={active === 'inhouse'}
        className={`${baseTab} ${active === 'inhouse' ? activeClass : inactiveClass}`}
      >
        <MaterialIcon name="group" size={16} />
        พักอยู่ในขณะนี้ ({counts.inhouse})
      </button>
    </div>
  )
}