'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

/** Search by code / name / email. Status lives in the page's tab bar. */
export function BookingFilters({ initialSearch }: { initialSearch: string }) {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const [search, setSearch] = useState(initialSearch)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(params.toString())
    if (search) next.set('q', search)
    else next.delete('q')
    next.delete('page')
    router.replace(`/reception/bookings?${next.toString()}`)
  }

  return (
    <form onSubmit={handleSearch} role="search" className="w-full sm:w-80">
      <label className="relative block">
        <span className="sr-only">{t('reception.bookingsPage.searchPlaceholder')}</span>
        <MaterialIcon
          name="search"
          size={20}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('reception.bookingsPage.searchPlaceholder')}
          className="w-full h-11 bg-surface-container-lowest rounded-xl pl-10 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-2 focus:outline-secondary"
        />
      </label>
    </form>
  )
}
