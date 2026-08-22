import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

type Tab = 'pending' | 'approved' | 'hidden'

interface ReviewsTabsProps {
  active: Tab
  pendingCount: number
  approvedCount: number
  hiddenCount: number
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'pending', label: 'รออนุมัติ', icon: 'pending_actions' },
  { key: 'approved', label: 'อนุมัติแล้ว', icon: 'check_circle' },
  { key: 'hidden', label: 'ซ่อนไว้', icon: 'visibility_off' },
]

export function ReviewsTabs({
  active,
  pendingCount,
  approvedCount,
  hiddenCount,
}: ReviewsTabsProps) {
  const counts: Record<Tab, number> = {
    pending: pendingCount,
    approved: approvedCount,
    hidden: hiddenCount,
  }

  return (
    <div className="flex items-center gap-1 border-b border-outline-variant mb-6 overflow-x-auto">
      {TABS.map((t) => {
        const isActive = active === t.key
        const badge = counts[t.key]
        return (
          <Link
            key={t.key}
            href={`/manager/reviews?tab=${t.key}`}
            className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <MaterialIcon name={t.icon} size={18} />
            <span className="text-body-md">{t.label}</span>
            {badge > 0 ? (
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-caption ${
                  t.key === 'pending'
                    ? 'bg-error text-on-error'
                    : t.key === 'approved'
                    ? 'bg-primary text-secondary'
                    : 'bg-surface-variant text-on-surface-variant'
                }`}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
