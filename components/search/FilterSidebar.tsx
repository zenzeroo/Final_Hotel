'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'
import type { RoomTypeName } from '@/lib/data/types'
import { formatRoomTypesParam, parseRoomTypesParam } from '@/lib/search/roomTypes'

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

  const currentTypes = parseRoomTypesParam(params.get('type'))
  const currentFloor = params.get('floor') ?? 'all'
  const currentPrice = params.get('priceRange') ?? 'all'
  // Below lg the filters fold behind one button so the rooms come first.
  const [open, setOpen] = useState(false)
  const activeCount = currentTypes.length + (currentFloor !== 'all' ? 1 : 0) + (currentPrice !== 'all' ? 1 : 0)

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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="room-filters"
        className="lg:hidden flex items-center justify-between h-12 px-5 rounded-2xl bg-surface-container-lowest text-body-md font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <span>
          {t('roomsList.filterHeading')}
          {activeCount > 0 && ` (${activeCount})`}
        </span>
        <MaterialIcon name={open ? 'expand_less' : 'expand_more'} size={22} />
      </button>
      <div id="room-filters" className={`${open ? 'flex' : 'hidden'} lg:flex flex-col gap-6`}>
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
              checked={currentTypes.includes(type)}
              onChange={(checked) => {
                // Multi-select: add/remove this type, keep the others.
                const next = checked
                  ? [...currentTypes, type]
                  : currentTypes.filter((name) => name !== type)
                updateParam('type', next.length ? formatRoomTypesParam(next) : null)
              }}
            />
          ))}
        </div>
      </Section>

      <Section title={t('roomsList.floor')}>
        <select
          value={currentFloor}
          onChange={(e) => updateParam('floor', e.target.value === 'all' ? null : e.target.value)}
          className="w-full h-12 px-4 rounded-lg bg-surface-container-low text-body-md text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
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
        className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-lg text-primary font-semibold text-body-md hover:bg-primary-fixed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <MaterialIcon name="refresh" size={16} />
        {t('roomsList.resetFilters')}
      </button>
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5">
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
    <label className="flex items-center gap-3 min-h-11 cursor-pointer group has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-secondary">
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
          checked
            ? 'bg-primary border-primary text-on-primary'
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
