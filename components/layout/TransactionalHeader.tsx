import Link from 'next/link'
import { MaterialIcon } from '../ui/MaterialIcon'

interface TransactionalHeaderProps {
  backHref: string
  title?: string
}

/**
 * Server component (Phase 52 fix — was briefly a client component
 * to support an `onBack` prop for the unpaid-booking leave-guard).
 * The leave-guard back button is now a separate client component
 * (`components/booking/LeaveGuardBackButton.tsx`) that the page mounts
 * alongside this header. Functions cannot cross the RSC boundary,
 * so passing `onBack` from a server file is forbidden.
 *
 * Always renders a plain `<Link href={backHref}>` for the back control.
 * When the leave-guard is active, the page also renders a fixed-
 * position button overlay (LeaveGuardBackButton) that sits on top of
 * this Link and intercepts the click.
 */
export function TransactionalHeader({ backHref, title }: TransactionalHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-outline-variant">
      <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop)">
        <div className="flex items-center justify-between h-16">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-on-surface hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            <MaterialIcon name="arrow_back" size={20} />
            <span>ย้อนกลับ</span>
          </Link>
          <Link
            href="/"
            className="font-display text-xl font-bold text-primary"
          >
            {title ?? 'Zenzero Hotel'}
          </Link>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>
    </header>
  )
}
