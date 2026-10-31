'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface SearchBoxProps {
  /** Page the search stays on, e.g. "/manager/staff". */
  basePath: string
  /** The current `?q=` value. */
  initialQuery: string
  placeholder: string
  buttonLabel: string
  className?: string
}

/**
 * URL-driven search box (`?q=`). Keeps every other query param (tab, week …)
 * and drops `page`, so a new search starts on the first page.
 */
export function SearchBox({ basePath, initialQuery, placeholder, buttonLabel, className = '' }: SearchBoxProps) {
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
    next.delete('page')
    const trimmed = value.trim()
    if (trimmed) next.set('q', trimmed)
    else next.delete('q')
    const qs = next.toString()
    router.replace(`${basePath}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        go(q)
      }}
      className={`flex items-center gap-2 max-w-2xl ${className}`}
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
            // The input's own clear (×) empties it — show everything again.
            if (e.target.value === '' && initialQuery) go('')
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={100}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-full pl-12 pr-4 py-3 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </div>
      <button
        type="submit"
        className="px-6 py-3 bg-primary text-secondary rounded-full font-semibold text-body-md hover:bg-primary-container transition-colors"
      >
        {buttonLabel}
      </button>
    </form>
  )
}
