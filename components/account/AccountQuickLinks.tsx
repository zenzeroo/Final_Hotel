import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * Quick links card on the left column of /account/profile.
 *
 * Currently exposes only the booking history link. Favorites and user-
 * promotions are deferred to Phase 27+ feature work — once those land,
 * add the entries back to the `links` array below (and the previous
 * placeholder branch can stay removed since all entries will be real).
 */
export function AccountQuickLinks() {
  const links: Array<{ href: string; icon: string; label: string }> = [
    { href: '/bookings', icon: 'history', label: 'ประวัติการจอง' },
  ]

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container flex flex-col divide-y divide-surface-container">
      {links.map((link) => {
        const className =
          'group flex items-center justify-between py-3 first:pt-0 last:pb-0 text-on-surface hover:bg-primary-fixed hover:text-primary transition-colors duration-200'
        const content = (
          <>
            <span className="flex items-center gap-3 font-body-md text-body-md">
              <MaterialIcon name={link.icon} className="text-on-surface-variant" />
              {link.label}
            </span>
            <MaterialIcon
              name="chevron_right"
              className="text-on-surface-variant transition-transform duration-200 group-hover:translate-x-1"
              size={18}
            />
          </>
        )
        return (
          <Link key={link.label} href={link.href} className={className}>
            {content}
          </Link>
        )
      })}
    </div>
  )
}