'use client'

/**
 * Phase 26 mini — client-side translation + locale hooks.
 *
 * Throws if used outside an `<I18nProvider>` so missing setup is loud
 * during development rather than silently rendering untranslated
 * strings.
 */
import { useContext } from 'react'
import { I18nContext, type I18nContextValue } from './I18nProvider'

/** Returns the `t(key, params?)` translator function. */
export function useT(): I18nContextValue['t'] {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useT() must be used inside <I18nProvider>')
  }
  return ctx.t
}

/** Returns the active Locale ('th' | 'en') for use in date/number formatters. */
export function useLocale(): I18nContextValue['locale'] {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useLocale() must be used inside <I18nProvider>')
  }
  return ctx.locale
}
