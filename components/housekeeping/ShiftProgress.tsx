'use client'

import { useT } from '@/lib/i18n/useT'

export function ShiftProgress({ percent }: { percent: number }) {
  const t = useT()
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="font-display text-[32px] leading-none text-primary tabular-nums">{clamped}%</span>
        <span className="text-[14px] text-on-surface-variant">{t('housekeeper.dashboardTabs.shiftTarget')}</span>
      </div>
      <div
        className="h-2 bg-surface-container rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('housekeeper.shiftProgress')}
      >
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}
