'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLocale, useT } from '@/lib/i18n/useT'
import { LOCALE_BCP47 } from '@/lib/i18n/config'

export interface BirthdateSelectProps {
  /** Form field name — the hidden input carries `YYYY-MM-DD`. */
  name: string
  /** ISO YYYY-MM-DD — latest allowed date (e.g. `maxBirthdateIso()`). */
  max: string
  /** ISO YYYY-MM-DD — initial value. */
  defaultValue?: string
  /** Earliest selectable year. */
  minYear?: number
  required?: boolean
}

interface Parts {
  day: string
  month: string
  year: string
}

interface Option {
  value: string
  label: string
  /** Extra strings a typed query may start with (month number, other-language names). */
  keywords?: string[]
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function split(iso: string | undefined): Parts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) } : { day: '', month: '', year: '' }
}

/** Options whose label/keyword starts with the query first, then label-contains matches. */
function filterOptions(options: Option[], query: string): Option[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  const starts: Option[] = []
  const contains: Option[] = []
  for (const o of options) {
    const label = o.label.toLowerCase()
    if (label.startsWith(q) || (o.keywords ?? []).some((k) => k.toLowerCase().startsWith(q))) starts.push(o)
    else if (label.includes(q)) contains.push(o)
  }
  return [...starts, ...contains]
}

/**
 * Type-to-filter field: typing a number or part of a name shows the
 * closest options; Enter / click picks one. On blur, the first match is
 * committed (or the previous value is kept when nothing matches).
 */
function ComboField({
  options,
  value,
  onChange,
  placeholder,
  required,
}: {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  required: boolean
}) {
  const listId = useId()
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value)
  const filtered = query === null ? options : filterOptions(options, query)

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function commit(option: Option | undefined) {
    if (option) onChange(option.value)
    setQuery(null)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault()
        commit(filtered[active])
      }
    } else if (e.key === 'Escape') {
      setQuery(null)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label={placeholder}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        value={query ?? selected?.label ?? ''}
        onFocus={(e) => {
          e.currentTarget.select()
          setActive(Math.max(0, options.findIndex((o) => o.value === value)))
          setOpen(true)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onBlur={() => {
          if (query !== null && query.trim() !== '') commit(filtered[0])
          else if (query !== null) commit(undefined)
          else setOpen(false)
        }}
        onKeyDown={onKeyDown}
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-3 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-(--shadow-ambient-lg)"
        >
          {filtered.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              // mousedown, not click — fires before the input's blur.
              onMouseDown={(e) => {
                e.preventDefault()
                commit(o)
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-body-md ${
                i === active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'
              } ${o.value === value ? 'font-semibold' : ''}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Birthdate as three type-to-filter fields (day / month / year) instead of
 * a calendar — picking a year decades back in a calendar popup is painful.
 * A hidden input submits `YYYY-MM-DD` (empty until all three are chosen),
 * so server actions read it exactly like the old date input.
 */
export function BirthdateSelect({ name, max, defaultValue, minYear = 1920, required = false }: BirthdateSelectProps) {
  const t = useT()
  const locale = useLocale()
  const [parts, setParts] = useState<Parts>(() => split(defaultValue))
  const maxParts = split(max)
  const maxYear = Number(maxParts.year)

  /** Drop a month/day that is no longer valid for the chosen year/month. */
  function update(patch: Partial<Parts>) {
    const next = { ...parts, ...patch }
    const y = Number(next.year)
    const atMaxYear = y === maxYear
    if (next.month && atMaxYear && Number(next.month) > Number(maxParts.month)) next.month = ''
    if (next.day) {
      const limit = next.month ? daysInMonth(y || 2000, Number(next.month)) : 31
      const atMaxMonth = atMaxYear && Number(next.month) === Number(maxParts.month)
      if (Number(next.day) > limit || (atMaxMonth && Number(next.day) > Number(maxParts.day))) next.day = ''
    }
    setParts(next)
  }

  const y = Number(parts.year)
  const atMaxYear = y === maxYear
  const atMaxMonth = atMaxYear && Number(parts.month) === Number(maxParts.month)
  const dayCount = Math.min(
    parts.month ? daysInMonth(y || 2000, Number(parts.month)) : 31,
    atMaxMonth ? Number(maxParts.day) : 31,
  )
  const monthCount = atMaxYear ? Number(maxParts.month) : 12

  const fmt = (loc: string, month: 'long' | 'short') => new Intl.DateTimeFormat(loc, { month, timeZone: 'UTC' })
  const own = fmt(LOCALE_BCP47[locale], 'long')
  // Match month names in both languages + the month number.
  const extra = [fmt('th-TH', 'long'), fmt('th-TH', 'short'), fmt('en-GB', 'long'), fmt('en-GB', 'short')]

  const dayOptions: Option[] = Array.from({ length: dayCount }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
  const monthOptions: Option[] = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(Date.UTC(2000, i, 1))
    return {
      value: String(i + 1),
      label: own.format(d),
      keywords: [String(i + 1), String(i + 1).padStart(2, '0'), ...extra.map((f) => f.format(d))],
    }
  })
  const yearOptions: Option[] = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
    const yr = String(maxYear - i)
    return { value: yr, label: yr }
  })

  const iso =
    parts.day && parts.month && parts.year
      ? `${parts.year}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`
      : ''

  return (
    <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
      <input type="hidden" name={name} value={iso} />
      <ComboField
        options={dayOptions}
        value={parts.day}
        onChange={(day) => update({ day })}
        placeholder={t('auth.birthDay')}
        required={required}
      />
      <ComboField
        options={monthOptions}
        value={parts.month}
        onChange={(month) => update({ month })}
        placeholder={t('auth.birthMonth')}
        required={required}
      />
      <ComboField
        options={yearOptions}
        value={parts.year}
        onChange={(year) => update({ year })}
        placeholder={t('auth.birthYear')}
        required={required}
      />
    </div>
  )
}
