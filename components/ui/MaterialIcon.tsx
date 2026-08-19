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
        fontVariationSettings: `"FILL" ${filled ? 1 : 0}`,
      }}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {name}
    </span>
  )
}
