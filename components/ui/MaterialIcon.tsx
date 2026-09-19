interface MaterialIconProps {
  name: string
  size?: number
  filled?: boolean
  className?: string
  'aria-label'?: string
}

export function MaterialIcon({
  name,
  size = 24,
  filled = false,
  className = '',
  'aria-label': ariaLabel,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: `${size}px`,
        // --icon-fill CSS var lets parents override fill weight on hover
        // via `group-hover:[--icon-fill:1]` (used by StaffSidebar Tier 3).
        // Default falls back to the `filled` prop value when no override.
        fontVariationSettings: `"FILL" var(--icon-fill, ${filled ? 1 : 0})`,
      }}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {name}
    </span>
  )
}
