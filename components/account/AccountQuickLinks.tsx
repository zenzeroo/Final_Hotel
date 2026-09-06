import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * Quick links card on the left column of /account/profile.
 *
 * Mirrors the mockup section:
 *   - ประวัติการจอง → /bookings (functional)
 *   - ห้องพักที่ถูกใจ → # placeholder (favorites feature not yet built)
 *   - โปรโมชั่นของฉัน → # placeholder (user-promotions feature not yet built)
 */
export function AccountQuickLinks() {
  const links: Array<{ href: string; icon: string; label: string }> = [
    { href: '/bookings', icon: 'history', label: 'ประวัติการจอง' },
    { href: '#', icon: 'favorite', label: 'ห้องพักที่ถูกใจ' },
    { href: '#', icon: 'local_offer', label: 'โปรโมชั่นของฉัน' },
  ]

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container flex flex-col divide-y divide-surface-container">
      {links.map((link) => {
        const isPlaceholder = link.href === '#'
        const className =
          'group flex items-center justify-between py-3 first:pt-0 last:pb-0 text-on-surface hover:text-primary transition-colors duration-200'
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
        return isPlaceholder ? (
          <a key={link.label} href={link.href} className={`${className} cursor-pointer opacity-60`}>
            {content}
          </a>
        ) : (
          <Link key={link.label} href={link.href} className={className}>
            {content}
          </Link>
        )
      })}
    </div>
  )
}