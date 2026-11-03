import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * High-contrast "blacklisted" pill — shown next to a customer's name
 * everywhere staff see them (admin, reception, walk-in). Label is passed
 * in so it works from both server (getT) and client (useT) components.
 */
export function BlacklistBadge({ label, size = 'sm' }: { label: string; size?: 'sm' | 'md' }) {
  const cls =
    size === 'md'
      ? 'gap-1.5 px-3 py-1 text-[12px]'
      : 'gap-1 px-2 py-0.5 text-[10px]'
  return (
    <span
      className={`inline-flex items-center rounded-full bg-on-surface text-surface ring-2 ring-error uppercase tracking-wider font-bold whitespace-nowrap ${cls}`}
      title={label}
    >
      <MaterialIcon name="gpp_bad" size={size === 'md' ? 16 : 12} className="text-error-container" />
      {label}
    </span>
  )
}
