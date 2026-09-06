/**
 * Date formatting utilities.
 */

export function formatDate(iso: string, locale = 'th-TH'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string, locale = 'th-TH'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatTime(iso: string, locale = 'th-TH'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
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
