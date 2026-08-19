import { MaterialIcon } from '../ui/MaterialIcon'

interface RatingStarsProps {
  value: number // 0.0 - 5.0
  count?: number // number of reviews
  size?: number
  showValue?: boolean
  className?: string
}

export function RatingStars({
  value,
  count,
  size = 16,
  showValue = true,
  className = '',
}: RatingStarsProps) {
  const rounded = Math.round(value * 2) / 2 // round to nearest 0.5
  const fullStars = Math.floor(rounded)
  const hasHalf = rounded % 1 !== 0

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <div className="flex">
        {[0, 1, 2, 3, 4].map((i) => {
          if (i < fullStars) {
            return (
              <MaterialIcon
                key={i}
                name="star"
                size={size}
                filled
                className="text-secondary"
              />
            )
          }
          if (i === fullStars && hasHalf) {
            return (
              <MaterialIcon
                key={i}
                name="star_half"
                size={size}
                filled
                className="text-secondary"
              />
            )
          }
          return (
            <MaterialIcon
              key={i}
              name="star"
              size={size}
              className="text-outline-variant"
            />
          )
        })}
      </div>
      {showValue && (
        <span className="text-label-md text-on-surface font-semibold">
          {value.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="text-caption text-on-surface-variant">
          ({count} รีวิว)
        </span>
      )}
    </div>
  )
}
