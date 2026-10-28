'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

interface HistoryFiltersProps {
  initialQuery: string
  /** Server-validated YYYY-MM-DD, or '' for no bound. */
  initialFrom: string
  initialTo: string
  category: string
  /** Category value → dictionary key for its label, in display order. */
  categories: { value: string; label: string }[]
}

/**
 * Guest-name search and date range (run on the button) + category dropdown
 * (applies on change). All live in the URL so the server page filters.
 */
export function HistoryFilters({
  initialQuery,
  initialFrom,
  initialTo,
  category,
  categories,
}: HistoryFiltersProps) {
  const t = useT()
  const router = useRouter()
  const [q, setQ] = useState(initialQuery)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  // Re-sync when the URL changes (back/forward) — adjust during render.
  const synced = `${initialQuery}|${initialFrom}|${initialTo}`
  const [syncedKey, setSyncedKey] = useState(synced)
  if (syncedKey !== synced) {
    setSyncedKey(synced)
    setQ(initialQuery)
    setFrom(initialFrom)
    setTo(initialTo)
  }

  function go(nextQ: string, nextCategory: string) {
    const params = new URLSearchParams()
    if (nextQ.trim()) params.set('q', nextQ.trim())
    if (nextCategory !== 'all') params.set('category', nextCategory)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    router.replace(qs ? `/reception/history?${qs}` : '/reception/history')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        go(q, category)
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="relative flex-1 min-w-60">
        <MaterialIcon
          name="search"
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('reception.historyPage.searchPlaceholder')}
          aria-label={t('reception.historyPage.searchPlaceholder')}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-full pl-12 pr-4 py-3 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </div>
      <DateField label={t('reception.common.from')} value={from} max={to || undefined} onChange={setFrom} />
      <DateField label={t('reception.common.to')} value={to} min={from || undefined} onChange={setTo} />
      <label className="flex flex-col gap-1">
        <span className="text-caption text-on-surface-variant font-semibold px-1">
          {t('reception.historyPage.categoryLabel')}
        </span>
        <select
          value={category}
          onChange={(e) => go(q, e.target.value)}
          className="bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-3 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {t(c.label)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="px-6 py-3 bg-primary text-secondary rounded-full font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
      >
        {t('reception.historyPage.search')}
      </button>
      {/* Always shown — also clears typed-but-not-searched values, which
          the URL (and so the re-sync above) doesn't know about. */}
      <button
        type="button"
        onClick={() => {
          setQ('')
          setFrom('')
          setTo('')
          router.replace('/reception/history')
        }}
        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full text-label-md font-semibold text-primary hover:bg-primary-fixed transition-colors"
      >
        <MaterialIcon name="filter_alt_off" size={18} />
        {t('reception.historyPage.clearFilters')}
      </button>
    </form>
  )
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption text-on-surface-variant font-semibold px-1">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-[0.6875rem] text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
      />
    </label>
  )
}
