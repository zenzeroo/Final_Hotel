'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

/**
 * Name / email search for /manager/staff (`?q=`). Keeps the role tab and the
 * shift week; the staff list and the shift grid both follow it.
 */
export function StaffSearch({ initialQuery }: { initialQuery: string }) {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(initialQuery)
  // Re-sync when the URL query changes (back/forward) — adjust during render.
  const [syncedQuery, setSyncedQuery] = useState(initialQuery)
  if (syncedQuery !== initialQuery) {
    setSyncedQuery(initialQuery)
    setQ(initialQuery)
  }

  const go = (value: string) => {
    const next = new URLSearchParams(params.toString())
    next.delete('page') // a new search starts at the first page
    const trimmed = value.trim()
    if (trimmed) next.set('q', trimmed)
    else next.delete('q')
    const qs = next.toString()
    router.replace(`/manager/staff${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        go(q)
      }}
      className="flex items-center gap-2 max-w-2xl mb-6"
    >
      <div className="relative flex-1">
        <MaterialIcon
          name="search"
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            // The input's own clear (×) empties it — show everyone again.
            if (e.target.value === '' && initialQuery) go('')
          }}
          placeholder={t('manager.staffPage.searchPlaceholder')}
          aria-label={t('manager.staffPage.searchPlaceholder')}
          maxLength={100}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-full pl-12 pr-4 py-3 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </div>
      <button
        type="submit"
        className="px-6 py-3 bg-primary text-secondary rounded-full font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
      >
        {t('manager.staffPage.search')}
      </button>
    </form>
  )
}
