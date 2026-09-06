import type { ReactNode } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface KpiCardProps {
  label: string
  icon?: string
  children: ReactNode
  tone?: 'default' | 'gold'
}

export function KpiCard({ label, icon, children, tone = 'default' }: KpiCardProps) {
  return (
    <div
      className={`rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1 ${
        tone === 'gold'
          ? 'bg-secondary-container text-on-secondary-container'
          : 'bg-surface-container-lowest'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-label-md uppercase tracking-wider opacity-80">{label}</p>
        {icon ? <MaterialIcon name={icon} size={18} className="opacity-70" /> : null}
      </div>
      {children}
    </div>
  )
}
