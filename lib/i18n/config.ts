/**
 * Phase 26 mini — i18n config.
 *
 * Single source of truth for the locales the app supports. Anything
 * that branches on language (cookie keys, dictionary loaders, type
 * aliases) should import from here.
 */

export const LOCALES = ['th', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'th'

/** Cookie that holds the user's chosen locale. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

/** Map Locale → BCP-47 tag used by Intl APIs (formatDate / toLocaleString). */
export const LOCALE_BCP47: Record<Locale, string> = {
  th: 'th-TH',
  en: 'en-US',
}

/** Narrow an arbitrary string (e.g. user input) to a known Locale. */
export function toLocale(value: unknown): Locale {
  return value === 'en' ? 'en' : 'th'
}
