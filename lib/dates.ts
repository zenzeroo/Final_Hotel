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
 * Compact date range string for narrow UI surfaces (tab pills, badges).
 * Examples (current calendar year):
 *   "2026-10-07","2026-10-07" → "7 ต.ค."
 *   "2026-10-07","2026-10-08" → "7 – 8 ต.ค."
 *   "2025-12-31","2026-01-02" → "31 ธ.ค. 2025 – 2 ม.ค. 2026"
 *
 * Drops the year when both endpoints fall in the same calendar year —
 * keeps pills compact. Year-crossing falls back to the full
 * `formatDateRange` so neither end is ambiguous. Forces Gregorian
 * calendar explicitly via `calendar: 'gregory'` to avoid the Buddhist
 * Era default that `th-TH` would otherwise render.
 */
export function formatDateRangeCompact(
  isoFrom: string,
  isoTo: string,
  locale = 'th-TH',
): string {
  const dFrom = new Date(isoFrom)
  const dTo = new Date(isoTo)
  if (Number.isNaN(dFrom.getTime()) || Number.isNaN(dTo.getTime())) return ''

  const monthFmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    calendar: 'gregory',
  })
  const dayFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
  })

  // Same day → just "D MMM" (drops year for compactness — caller is
  // typically the today-tab pill on /reception/check-in-out where the
  // year is implied by the surrounding UI).
  if (isoFrom === isoTo) {
    return `${dayFmt.format(dFrom)} ${monthFmt.format(dFrom)}`
  }

  const sameYear = dFrom.getFullYear() === dTo.getFullYear()
  if (sameYear) {
    // "D – D MMM" — day-only span with month on the closing date.
    const dayFrom = dayFmt.format(dFrom)
    const dayTo = dayFmt.format(dTo)
    const monthTo = monthFmt.format(dTo)
    return `${dayFrom} – ${dayTo} ${monthTo}`
  }

  // Year-crossing — fall back to full format on both ends.
  return formatDateRange(isoFrom, isoTo, locale)
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
 * Phase 53 — Asia/Bangkok + Gregorian short date for the housekeeper
 * history page. Pinned `timeZone` + `calendar` so server (Node/UTC
 * default) and client (any browser locale) render identical strings.
 * Returns "14 ต.ค. 2026" (th) or "14 Oct 2026" (en).
 */
export function formatBangkokDate(
  iso: string,
  locale: 'th-TH' | 'en-GB' = 'th-TH',
): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
  }).format(d)
}

/**
 * Phase 53 — Asia/Bangkok 24-hour time for the housekeeper history
 * page. Returns "14:01" (th or en — both use 24h by default). The
 * existing `formatTime` uses the runtime's local TZ which can drift
 * between server (Node) and client (browser) and trigger hydration
 * mismatches; this helper is explicit and safe.
 */
export function formatBangkokTime(
  iso: string,
  locale: 'th-TH' | 'en-GB' = 'th-TH',
): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
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
 * Today in **Asia/Bangkok** timezone, ISO YYYY-MM-DD. Returns the same
 * value on server and client regardless of the host's local timezone
 * — the implementation uses `Intl.DateTimeFormat` with an explicit
 * `timeZone: 'Asia/Bangkok'` so a browser running in UTC (or any
 * other TZ) still gets the Bangkok-anchored date. This is the canonical
 * "today" used by every check-in validation, <input min=…> attribute,
 * and server-side past-date check.
 *
 * CRITICAL: do NOT use `new Date().toISOString().slice(0, 10)` as a
 * "today" replacement — that returns UTC and is off-by-one for
 * Bangkok users at 00:00-06:59 local time.
 */
export function getTodayBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Tomorrow in **Asia/Bangkok** timezone, ISO YYYY-MM-DD. TZ-safe via
 * `Intl.DateTimeFormat` (mirrors `getTodayBangkok()`).
 */
export function getTomorrowBangkok(): string {
  const today = new Date(`${getTodayBangkok()}T00:00:00+07:00`)
  today.setDate(today.getDate() + 1)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today)
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
 * Minimum legal check-in date in **Asia/Bangkok** timezone. Phase 49
 * changed policy to allow same-day check-in (was previously tomorrow).
 * Use this as both the `<input type="date" min>` attribute and the
 * default check-in value.
 */
export function getMinCheckInLocalIso(): string {
  return getTodayBangkok()
}
