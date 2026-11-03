'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

interface CustomerSearchProps {
  initialQuery: string
}

export function CustomerSearch({ initialQuery }: CustomerSearchProps) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(initialQuery)
  // Re-sync when the URL query changes (back/forward) — adjust during render
  // instead of in an effect.
  const [syncedQuery, setSyncedQuery] = useState(initialQuery)
  if (syncedQuery !== initialQuery) {
    setSyncedQuery(initialQuery)
    setQ(initialQuery)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(params.toString())
    if (q) next.set('q', q)
    else next.delete('q')
    router.replace(`${pathname}?${next.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-2xl">
      <div className="relative flex-1">
        <MaterialIcon
          name="search"
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('reception.customersPage.inputPlaceholder')}
          className="w-full h-11 bg-surface-container-lowest border border-transparent rounded-xl pl-12 pr-4 text-body-md text-on-surface placeholder:text-on-surface-variant hover:border-outline-variant focus:outline-none focus:border-secondary transition-colors"
        />
      </div>
      <button
        type="submit"
        className="h-11 px-6 bg-primary text-on-primary rounded-xl font-semibold text-body-md hover:bg-primary-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        {t('reception.customersPage.search')}
      </button>
    </form>
  )
}
