'use client'

import { useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

interface RatingInputProps {
  name: string
  value: number
  onChange: (v: number) => void
  size?: number
  className?: string
}

/**
 * Interactive 5-star rating picker. Controlled component.
 * The numeric value is also rendered as a hidden input so it submits with a form.
 */
export function RatingInput({
  name,
  value,
  onChange,
  size = 32,
  className = '',
}: RatingInputProps) {
  const t = useT()
  const [hover, setHover] = useState<number>(0)
  const display = hover || value

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      <div className="inline-flex items-center gap-1" role="radiogroup" aria-label={t('customer.rating.groupLabel')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('customer.rating.star', { count: n })}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-0 bg-transparent border-0 cursor-pointer"
          >
            <MaterialIcon
              name="star"
              size={size}
              filled={n <= display}
              className={n <= display ? 'text-secondary' : 'text-outline-variant'}
            />
          </button>
        ))}
        <span className="ml-2 text-body-md text-on-surface-variant">
          {display > 0 ? `${display} / 5` : t('customer.rating.pick')}
        </span>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  )
}
