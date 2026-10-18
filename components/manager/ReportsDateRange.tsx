'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

interface ReportsDateRangeProps {
  /** Server-validated range start (YYYY-MM-DD). */
  from: string
  /** Server-validated range end (YYYY-MM-DD), always >= from. */
  to: string
  /** True when the range equals the default (last 7 days) — hides the reset button. */
  isDefault: boolean
}

/**
 * Date range picker for /manager/reports — writes `?from=&to=` and lets the
 * server page re-fetch. Same pill style as `CheckInOutDateRange`. Moving
 * `from` past `to` drags `to` along so the range stays valid; the server
 * (`parseReportRange`) still validates and clamps whatever lands in the URL.
 */
export function ReportsDateRange({ from, to, isDefault }: ReportsDateRangeProps) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(nextFrom: string | null, nextTo: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextFrom) params.set('from', nextFrom)
    else params.delete('from')
    if (nextTo) params.set('to', nextTo)
    else params.delete('to')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function handleFromChange(v: string) {
    if (!v) return
    navigate(v, v > to ? v : to)
  }

  function handleToChange(v: string) {
    if (!v) return
    navigate(from, v)
  }

  const pill =
    'relative inline-flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-full pl-3 pr-4 py-1.5 hover:border-secondary focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-colors'

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <label className={pill}>
        <MaterialIcon name="calendar_today" size={16} className="text-on-surface-variant shrink-0" />
        <div className="flex flex-col">
          <span className="text-caption text-on-surface-variant font-semibold uppercase tracking-wider leading-none">
            {t('manager.reportsPage.from')}
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
            aria-label={t('manager.reportsPage.fromAria')}
            className="bg-transparent text-body-md text-on-surface focus:outline-none w-32"
          />
        </div>
      </label>

      <label className={pill}>
        <MaterialIcon name="event" size={16} className="text-on-surface-variant shrink-0" />
        <div className="flex flex-col">
          <span className="text-caption text-on-surface-variant font-semibold uppercase tracking-wider leading-none">
            {t('manager.reportsPage.to')}
          </span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => handleToChange(e.target.value)}
            aria-label={t('manager.reportsPage.toAria')}
            className="bg-transparent text-body-md text-on-surface focus:outline-none w-32"
          />
        </div>
      </label>

      {!isDefault && (
        <button
          type="button"
          onClick={() => navigate(null, null)}
          className="ml-1 text-caption text-primary font-semibold uppercase tracking-wider px-2 py-1 rounded hover:bg-primary-fixed transition-colors"
        >
          {t('manager.reportsPage.last7')}
        </button>
      )}
    </div>
  )
}
