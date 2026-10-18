/**
 * Phase 27.D — locale-aware formatting shared by the email templates.
 * Dates are formatted in the hotel's timezone so a guest never sees a
 * UTC-shifted day.
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

/** `YYYY-MM-DD` (a calendar date) → "18 Oct 2026" / "18 ต.ค. 2569". */
export function formatEmailDate(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00+07:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], { dateStyle: 'medium', timeZone: HOTEL_TZ }).format(d)
}

/** Full ISO timestamp → date + time in hotel time. */
export function formatEmailDateTime(isoTimestamp: string, locale: Locale): string {
  const d = new Date(isoTimestamp)
  if (Number.isNaN(d.getTime())) return isoTimestamp
  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: HOTEL_TZ,
  }).format(d)
}
