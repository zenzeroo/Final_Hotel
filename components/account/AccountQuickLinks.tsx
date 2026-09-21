import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { TruncatedText } from '@/components/ui/TruncatedText'

export interface QuickLink {
  href: string
  icon: string
  label: string
}

interface AccountQuickLinksProps {
  links: readonly QuickLink[]
}

/**
 * Quick links card on the left column of the profile page.
 *
 * Returns `null` when `links` is empty so callers can pass `[]` for roles
 * with no quick links (e.g. admin/manager) without rendering an empty card.
 *
 * Layout stability (Phase 26 hotfix): the label sits between the icon
 * (left) and the chevron (right). `min-w-0 truncate flex-1` on the label
 * keeps the chevron pinned right even when TH/EN labels differ in width.
 */
export function AccountQuickLinks({ links }: AccountQuickLinksProps) {
  if (links.length === 0) return null
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container flex flex-col divide-y divide-surface-container">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          title={link.label}
          className="group flex items-center justify-between first:pt-0 last:pb-0 py-3 px-gutter text-on-surface hover:bg-primary-fixed hover:text-primary transition-colors duration-200 min-w-0"
        >
          <span className="flex items-center gap-3 font-body-md text-body-md min-w-0 flex-1">
            <MaterialIcon name={link.icon} className="text-on-surface-variant flex-shrink-0" />
            <TruncatedText text={link.label} />
          </span>
          <MaterialIcon
            name="chevron_right"
            className="text-on-surface-variant flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
            size={18}
          />
        </Link>
      ))}
    </div>
  )
}
