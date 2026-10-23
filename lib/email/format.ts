/**
 * Phase 27.D — locale-aware formatting shared by the email templates.
 * Dates are formatted in the hotel's timezone so a guest never sees a
 * UTC-shifted day. Dates are DD/MM/YYYY (Gregorian year) in every locale,
 * the same as the website (lib/dates.ts).
 */
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'

const HOTEL_TZ = 'Asia/Bangkok'

export function formatEmailMoney(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

/** `YYYY-MM-DD` (a calendar date) → "18/10/2026". No timezone shift. */
export function formatEmailDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate
}

/** Full ISO timestamp → "18/10/2026 14:05" in hotel time (24-hour). */
export function formatEmailDateTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  if (Number.isNaN(d.getTime())) return isoTimestamp
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: HOTEL_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  )
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}
