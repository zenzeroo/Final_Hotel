import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export type BadgeTone = 'error' | 'primary' | 'default'

export interface TabItem<T extends string = string> {
  key: T
  label: string
  href: string
  icon?: string
  badge?: number | null
  badgeTone?: BadgeTone
}

interface TabsProps<T extends string> {
  active: T
  tabs: TabItem<T>[]
}

export function Tabs<T extends string>({ active, tabs }: TabsProps<T>) {
  return (
    <div className="flex items-center gap-1 border-b border-outline-variant mb-6 overflow-x-auto">
      {tabs.map((t) => {
        const isActive = active === t.key
        const showBadge = t.badge != null && t.badge > 0
        const badgeClass =
          t.badgeTone === 'error'
            ? 'bg-error text-on-error'
            : t.badgeTone === 'primary'
              ? 'bg-primary text-secondary'
              : 'bg-surface-variant text-on-surface-variant'
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-primary bg-primary text-on-primary font-semibold'
                : 'border-transparent text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
            }`}
          >
            {t.icon ? <MaterialIcon name={t.icon} size={18} /> : null}
            <span className="text-body-md">{t.label}</span>
            {showBadge ? (
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-caption ${badgeClass}`}
              >
                {t.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
