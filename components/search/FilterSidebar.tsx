'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'
import type { RoomTypeName } from '@/lib/data/types'

const PRICE_RANGES = [
  { value: 'under3000' as const },
  { value: '3000-6000' as const },
  { value: 'over6000' as const },
]

const ROOM_TYPE_LABELS: Record<RoomTypeName, { th: string; en: string }> = {
  Deluxe: { th: 'ดีลักซ์', en: 'Deluxe' },
  Suite: { th: 'สวีท', en: 'Suite' },
  Villa: { th: 'วิลล่า', en: 'Villa' },
}

interface FilterSidebarProps {
  roomTypes: readonly RoomTypeName[]
  floors: readonly number[]
}

export function FilterSidebar({ roomTypes, floors }: FilterSidebarProps) {
  const router = useRouter()
  const params = useSearchParams()
  const t = useT()

  const currentType = params.get('type') ?? 'all'
  const currentFloor = params.get('floor') ?? 'all'
  const currentPrice = params.get('priceRange') ?? 'all'

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value === null || value === 'all') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      router.replace(`/rooms?${next.toString()}`, { scroll: false })
    },
    [params, router]
  )

  // Localize the price-range label based on the current locale.
  // (The locale lives in the I18nProvider cookie — we can read it via
  // useT() in tandem with a sentinel match, but here it's cheaper to
  // dispatch on the key prefix from the active dictionary.)
  const priceLabels: Record<string, string> = {
    under3000: t('roomsList.under3000'),
    '3000-6000': t('roomsList.price3000to6000'),
    over6000: t('roomsList.over6000'),
  }
  // Detect locale by checking which set is in the dictionary.
  const isEn = priceLabels.under3000.includes('Under')

  return (
    <aside className="flex flex-col gap-6">
      <Section title={t('roomsList.priceRange')}>
        <div className="flex flex-col gap-2">
          {PRICE_RANGES.map((range) => (
            <Checkbox
              key={range.value}
              label={priceLabels[range.value]}
              checked={currentPrice === range.value}
              onChange={(checked) =>
                updateParam('priceRange', checked ? range.value : null)
              }
            />
          ))}
        </div>
      </Section>

      <Section title={t('roomsList.roomType')}>
        <div className="flex flex-col gap-2">
          {roomTypes.map((type) => (
            <Checkbox
              key={type}
              label={ROOM_TYPE_LABELS[type][isEn ? 'en' : 'th']}
              checked={currentType === type}
              onChange={(checked) =>
                updateParam('type', checked ? type : null)
              }
            />
          ))}
        </div>
      </Section>

      <Section title={t('roomsList.floor')}>
        <select
          value={currentFloor}
          onChange={(e) => updateParam('floor', e.target.value === 'all' ? null : e.target.value)}
          className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary border border-outline-variant"
          aria-label={t('roomsList.floor')}
        >
          <option value="all">{t('roomsList.any')}</option>
          {floors.map((f) => (
            <option key={f} value={f}>
              {t('roomsList.floor')} {f}
            </option>
          ))}
        </select>
      </Section>

      <button
        type="button"
        onClick={() => router.replace('/rooms', { scroll: false })}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-surface-container-low transition-colors"
      >
        <MaterialIcon name="refresh" size={16} />
        {t('roomsList.resetFilters')}
      </button>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-(--shadow-ambient) border border-outline-variant">
      <h3 className="font-display text-lg text-primary mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
          checked
            ? 'bg-primary border-primary text-secondary'
            : 'border-outline group-hover:border-primary'
        }`}
        aria-hidden
      >
        {checked && <MaterialIcon name="check" size={14} filled />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-body-md text-on-surface">{label}</span>
    </label>
  )
}
