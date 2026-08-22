import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

type Tab = 'main' | 'refunds' | 'audit'

interface BookingsOversightTabsProps {
  active: Tab
  refundCount: number
}

const TABS: { key: Tab; label: string; icon: string; base: string }[] = [
  { key: 'main', label: 'Main Bookings', icon: 'bookmark', base: '/manager/bookings' },
  { key: 'refunds', label: 'คำขอคืนเงิน', icon: 'undo', base: '/manager/bookings?tab=refunds' },
  { key: 'audit', label: 'Audit Log', icon: 'history', base: '/manager/bookings?tab=audit' },
]

export function BookingsOversightTabs({ active, refundCount }: BookingsOversightTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-outline-variant mb-6 overflow-x-auto">
      {TABS.map((t) => {
        const isActive = active === t.key
        const href = t.key === 'main' ? '/manager/bookings' : `/manager/bookings?tab=${t.key}`
        const badge = t.key === 'refunds' && refundCount > 0 ? refundCount : null
        return (
          <Link
            key={t.key}
            href={href}
            className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <MaterialIcon name={t.icon} size={18} />
            <span className="text-body-md">{t.label}</span>
            {badge != null ? (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-error text-on-error text-caption">
                {badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
