'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface BookingFiltersProps {
  initialStatus: string
  initialSearch: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'confirmed', label: 'รอชำระ' },
  { value: 'checked_in', label: 'เข้าพัก' },
  { value: 'checked_out', label: 'เช็คเอาท์' },
  { value: 'cancelled', label: 'ยกเลิก' },
]

export function BookingFilters({ initialStatus, initialSearch }: BookingFiltersProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [search, setSearch] = useState(initialSearch)
  const [, startTransition] = useTransition()

  const updateStatus = (status: string) => {
    const next = new URLSearchParams(params.toString())
    if (status === 'all') next.delete('status')
    else next.set('status', status)
    router.replace(`/reception/bookings?${next.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(params.toString())
    if (search) next.set('q', search)
    else next.delete('q')
    router.replace(`/reception/bookings?${next.toString()}`)
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = (initialStatus ?? 'all') === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateStatus(opt.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-label-md font-semibold transition-colors ${
                isActive
                  ? 'bg-primary text-secondary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 md:ml-auto">
        <div className="relative">
          <MaterialIcon
            name="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัส / ชื่อ / อีเมล"
            className="bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors w-64"
          />
        </div>
      </form>
    </div>
  )
}
