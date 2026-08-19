import Link from 'next/link'
import { MaterialIcon } from '../ui/MaterialIcon'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
}

export function EmptyState({ icon, title, description, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-container text-on-surface-variant mb-6">
        <MaterialIcon name={icon} size={40} />
      </div>
      <h3 className="font-display text-2xl text-primary mb-2">{title}</h3>
      <p className="text-body-md text-on-surface-variant max-w-md mb-6">{description}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
        >
          {ctaLabel}
          <MaterialIcon name="arrow_forward" size={18} />
        </Link>
      )}
    </div>
  )
}
