'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'

const PRICE_RANGES = [
  { value: 'under3000', label: 'ต่ำกว่า ฿3,000' },
  { value: '3000-6000', label: '฿3,000 - ฿6,000' },
  { value: 'over6000', label: 'มากกว่า ฿6,000' },
] as const

const ROOM_TYPES = [
  { value: 'Deluxe', label: 'ดีลักซ์' },
  { value: 'Suite', label: 'สวีท' },
  { value: 'Villa', label: 'วิลล่า' },
] as const

const FLOORS = [1, 2, 3, 4] as const

export function FilterSidebar() {
  const router = useRouter()
  const params = useSearchParams()

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

  return (
    <aside className="flex flex-col gap-6">
      <Section title="ช่วงราคา">
        <div className="flex flex-col gap-2">
          {PRICE_RANGES.map((range) => (
            <Checkbox
              key={range.value}
              label={range.label}
              checked={currentPrice === range.value}
              onChange={(checked) =>
                updateParam('priceRange', checked ? range.value : null)
              }
            />
          ))}
        </div>
      </Section>

      <Section title="ประเภทห้องพัก">
        <div className="flex flex-col gap-2">
          {ROOM_TYPES.map((type) => (
            <Checkbox
              key={type.value}
              label={type.label}
              checked={currentType === type.value}
              onChange={(checked) =>
                updateParam('type', checked ? type.value : null)
              }
            />
          ))}
        </div>
      </Section>

      <Section title="ชั้น">
        <select
          value={currentFloor}
          onChange={(e) => updateParam('floor', e.target.value === 'all' ? null : e.target.value)}
          className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary border border-outline-variant"
          aria-label="เลือกชั้น"
        >
          <option value="all">ทุกชั้น</option>
          {FLOORS.map((f) => (
            <option key={f} value={f}>
              ชั้น {f}
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
        รีเซ็ตตัวกรอง
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
