'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

interface CheckInOutListSearchProps {
  /** Server-resolved initial search (URL ?q= or empty). */
  initialQuery: string
}

/**
 * Phase 48d — guest search for the active list on
 * /reception/check-in-out. Filters the already-tab+range-filtered
 * list by guest name / booking code / email via the server-side
 * `?q=` URL param (mirrors /reception/bookings BookingFilters).
 *
 * Behavior: realtime input with a 350ms debounce (matches SearchBar
 * guests handler at SearchBar.tsx:149-159). URL navigation uses
 * `router.replace` with `{ scroll: false }` so the page re-renders
 * in place without scroll jumps or history pollution. Other URL
 * params (`?tab=&checkin=&checkout=`) are preserved — switching the
 * search must not reset the user's tab or date range.
 *
 * URL canonicality: an empty query is omitted from the URL so
 * `/check-in-out?q=` collapses back to `/check-in-out` once the
 * user clears the input.
 */
export function CheckInOutListSearch({ initialQuery }: CheckInOutListSearchProps) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup pending debounce on unmount — same pattern as SearchBar.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function navigate(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = nextQuery.trim()
    if (trimmed) params.set('q', trimmed)
    else params.delete('q')
    const qs = params.toString()
    const target = qs ? `${pathname}?${qs}` : pathname
    router.replace(target, { scroll: false })
  }

  function handleChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      navigate(v)
    }, 350)
  }

  return (
    <div className="relative w-full md:w-72 md:ml-auto">
      <MaterialIcon
        name="search"
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t('reception.checkInOutPage.searchPlaceholder')}
        aria-label={t('reception.checkInOutPage.searchAria')}
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
      />
    </div>
  )
}