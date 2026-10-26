import Link from 'next/link'
import { MaterialIcon } from '../ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

interface TransactionalHeaderProps {
  backHref: string
}

/**
 * Server component (Phase 52 fix — was briefly a client component
 * to support an `onBack` prop for the unpaid-booking leave-guard;
 * functions cannot cross the RSC boundary).
 *
 * Always renders a plain `<Link href={backHref}>` for the back control.
 * On an unpaid /bookings/[id], LeaveGuardProvider's click-capture
 * listener intercepts this Link (like every same-origin link) and opens
 * the leave dialog — no overlay button is needed.
 */
export async function TransactionalHeader({ backHref }: TransactionalHeaderProps) {
  const t = getT(await getLocale())
  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-outline-variant">
      <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop)">
        {/* Back control only — the hotel name already sits in TopNavBar above. */}
        <div className="flex items-center h-16">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-on-surface hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            <MaterialIcon name="arrow_back" size={20} />
            <span>{t('customer.common.back')}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
