'use client'

import { useT } from '@/lib/i18n/useT'

export function ShiftProgress({ percent }: { percent: number }) {
  const t = useT()
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="font-display-lg text-display-lg text-primary">{clamped}%</span>
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">{t('housekeeper.dashboardTabs.shiftTarget')}</span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div
          className="h-full bg-secondary transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}