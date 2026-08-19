import Link from 'next/link'
import { MaterialIcon } from '../ui/MaterialIcon'

interface TransactionalHeaderProps {
  backHref: string
  title?: string
}

/**
 * Minimal header for transactional flows (booking confirmation, payment).
 * Suppresses main nav — keeps just a back button + brand.
 */
export function TransactionalHeader({ backHref, title }: TransactionalHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-outline-variant">
      <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop)">
        <div className="flex items-center justify-between h-16">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-body-md text-on-surface hover:text-primary transition-colors"
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
