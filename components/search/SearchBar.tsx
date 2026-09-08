'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { getLocalIsoDate, getTodayLocalIso, getTomorrowLocalIso } from '@/lib/dates'

interface SearchBarProps {
  variant?: 'hero' | 'compact'
  defaultCheckin?: string
  defaultCheckout?: string
  defaultGuests?: number
}

export function SearchBar({
  variant = 'hero',
  defaultCheckin,
  defaultCheckout,
  defaultGuests = 2,
}: SearchBarProps) {
  const router = useRouter()

  const [checkin, setCheckin] = useState(() => defaultCheckin ?? getTodayLocalIso())
  const [checkout, setCheckout] = useState(() => defaultCheckout ?? getTomorrowLocalIso())
  const [guests, setGuests] = useState(defaultGuests)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams({
      checkin,
      checkout,
      guests: String(guests),
    })
    router.push(`/rooms?${params.toString()}`)
  }

  const isHero = variant === 'hero'

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col md:flex-row items-stretch gap-3 md:gap-2 ${
        isHero
          ? 'bg-surface-container-lowest p-4 md:p-3 rounded-2xl shadow-(--shadow-ambient-lg) md:rounded-full'
          : 'bg-surface-container-lowest p-4 rounded-2xl shadow-(--shadow-ambient)'
      }`}
    >
      {/* Check-in */}
      <DateField
        label="เช็คอิน"
        value={checkin}
        min={getTodayLocalIso()}
        onChange={(v) => {
          setCheckin(v)
          if (v >= checkout) {
            const next = new Date(v)
            next.setDate(next.getDate() + 1)
            setCheckout(getLocalIsoDate(next))
          }
        }}
      />

      {/* Check-out */}
      <DateField
        label="เช็คเอาท์"
        value={checkout}
        min={checkin > getTodayLocalIso() ? checkin : getTodayLocalIso()}
        onChange={setCheckout}
      />

      {/* Guests */}
      <div
        className={`flex-1 flex items-center gap-3 ${
          isHero
            ? 'md:px-4 md:py-2 md:border-l md:border-outline-variant'
            : 'px-4 py-3 border border-outline-variant rounded-xl'
        }`}
      >
        <span className="text-label-md text-on-surface-variant shrink-0">ผู้เข้าพัก</span>
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={() => setGuests((g) => Math.max(1, g - 1))}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
            aria-label="ลดจำนวนผู้เข้าพัก"
          >
            <MaterialIcon name="remove" size={16} />
          </button>
          <span className="text-body-md font-semibold w-6 text-center">{guests}</span>
          <button
            type="button"
            onClick={() => setGuests((g) => Math.min(10, g + 1))}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
            aria-label="เพิ่มจำนวนผู้เข้าพัก"
          >
            <MaterialIcon name="add" size={16} />
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className={`inline-flex items-center justify-center gap-2 ${
          isHero
            ? 'md:rounded-full bg-primary text-on-primary px-6 py-3 md:py-2 rounded-xl'
            : 'rounded-xl bg-primary text-on-primary px-6 py-3'
        } font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors`}
      >
        <MaterialIcon name="search" size={20} />
        <span>ค้นหาห้องพัก</span>
      </button>
    </form>
  )
}

function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: string
  min: string
  onChange: (v: string) => void
}) {
  return (
    <label
      className={`flex-1 flex items-center gap-3 px-4 py-3 ${
        /* keep simple styling for hero variant: input inside pill */
        ''
      }`}
    >
      <MaterialIcon name="calendar_today" size={20} className="text-on-surface-variant shrink-0" />
      <div className="flex flex-col">
        <span className="text-caption text-on-surface-variant font-semibold uppercase tracking-wider">
          {label}
        </span>
        <input
          type="date"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-body-md font-medium text-on-surface focus:outline-none"
        />
      </div>
    </label>
  )
}
