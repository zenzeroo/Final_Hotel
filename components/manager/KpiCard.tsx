import type { ReactNode } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { TruncatedText } from '@/components/ui/TruncatedText'

interface KpiCardProps {
  label: string
  icon?: string
  children: ReactNode
  tone?: 'default' | 'gold'
}

export function KpiCard({ label, icon, children, tone = 'default' }: KpiCardProps) {
  return (
    <div
      className={`rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1 min-w-0 ${
        tone === 'gold'
          ? 'bg-secondary-container text-on-secondary-container'
          : 'bg-surface-container-lowest'
      }`}
    >
      <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
        {/* Label varies in width across TH/EN ("รายได้วันนี้" vs
            "Today's Revenue"). Truncate + title keeps the icon pinned
            right when label grows wider than the card allows. */}
        <TruncatedText
          text={label}
          as="p"
          className="text-label-md uppercase tracking-wider opacity-80"
        />
        {icon ? (
          <MaterialIcon
            name={icon}
            size={18}
            className="opacity-70 flex-shrink-0"
          />
        ) : null}
      </div>
      {children}
    </div>
  )
}
