/**
 * Date formatting utilities.
 *
 * Note: all date+time formatters pass `calendar: 'gregory'` so the Thai
 * locale renders AD year (2026) instead of the Buddhist year (2569) that
 * `'th-TH'` uses by default. Thai month/day names stay intact.
 */

const dateOptions: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  calendar: 'gregory',
}

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  ...dateOptions,
  hour: '2-digit',
  minute: '2-digit',
}

export function formatDate(iso: string, locale = 'th-TH'): string {
  return new Intl.DateTimeFormat(locale, dateOptions).format(new Date(iso))
}

export function formatDateTime(iso: string, locale = 'th-TH'): string {
  return new Intl.DateTimeFormat(locale, dateTimeOptions).format(new Date(iso))
}

export function formatTime(iso: string, locale = 'th-TH'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Format a date range "from – to" with one shared locale. Eliminates the
 * repeated `{formatDate(a)} – {formatDate(b)}` pattern at booking history
 * tables, promotion previews, seasonal rates lists, etc.
 */
export function formatDateRange(
  isoFrom: string,
  isoTo: string,
  locale = 'th-TH',
): string {
  const fmt = new Intl.DateTimeFormat(locale, dateOptions)
  return `${fmt.format(new Date(isoFrom))} – ${fmt.format(new Date(isoTo))}`
}

/**
 * Format ISO date as Gregorian numeric DD/MM/YYYY.
 * Example: "2026-09-23" → "23/09/2026"
 *
 * Used by /rooms SearchBar + BookingWidget where the UI expects a
 * compact numeric layout. Forces Gregorian calendar explicitly via
 * the `calendar: 'gregory'` option (matching `formatDate` /
 * `formatDateTime` in this file) — the `th-TH` locale otherwise
 * defaults to Buddhist Era and would render "23/09/2569".
 */
export function formatDateNumeric(iso: string, locale = 'th-TH'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    calendar: 'gregory',
  }).format(d)
}

/**
 * Maximum legal birthdate for an "age >= 18" gate — i.e. today minus 18
 * years in ISO YYYY-MM-DD. Used as the `max=` attribute on
 * <input type="date"> so the browser's native date picker won't even let
 * a minor click a valid date.
 */
export function maxBirthdateIso(): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - 18)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Server-side mirror of the same gate. Returns true iff birthdateIso is a
 * valid ISO date and the user is at least 18 years old as of today.
 * UTC math avoids local-TZ off-by-one issues with leap years.
 */
export function isOver18(birthdateIso: string): boolean {
  const born = new Date(birthdateIso)
  if (Number.isNaN(born.getTime())) return false
  const now = new Date()
  let age = now.getUTCFullYear() - born.getUTCFullYear()
  const m = now.getUTCMonth() - born.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age--
  return age >= 18
}

/**
 * Format a Date as ISO YYYY-MM-DD using **local time components** (not
 * `Date#toISOString()` which always returns UTC). Use this for any
 * `<input type="date" min=… value=…>` constraint — using UTC causes
 * off-by-one bugs in any timezone west of UTC (e.g. a Thai user at
 * 06:00 local sees `min= 2026-09-07` instead of their real today
 * 2026-09-08).
 */
export function getLocalIsoDate(d: Date = new Date()): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Today in the **server's** local timezone, ISO YYYY-MM-DD. Equivalent
 * to `getLocalIsoDate(new Date())` — provided as a named shortcut for
 * `<input min=…>` sites.
 */
export function getTodayLocalIso(): string {
  return getLocalIsoDate()
}

/**
 * Tomorrow in the server's local timezone (today + 1 day). Use for
 * default checkout values.
 */
export function getTomorrowLocalIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return getLocalIsoDate(d)
}

/**
 * Add `days` (signed) to an ISO YYYY-MM-DD date and return the result
 * in the same local-time shape. Negative values subtract. Uses
 * `Date#setDate` (which mutates in-place) so no allocation churn.
 */
export function addDaysLocalIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return getLocalIsoDate(d)
}

/**
 * Minimum legal check-in date in local time. Hotels require at least 1
 * day of advance booking — same-day check-in is not allowed. Use this
 * as both the `<input type="date" min>` attribute and the default
 * check-in value.
 */
export function getMinCheckInLocalIso(): string {
  return getTomorrowLocalIso()
}
