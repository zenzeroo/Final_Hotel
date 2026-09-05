'use client'

/**
 * Phase 26 mini — client-side locale context.
 *
 * Server components should use `getLocale()` + `getT()` directly.
 * This context is for the small client-component subtree that needs to
 * render translated strings (forms, dropdowns). The provider is mounted
 * once near the root of the tree, and child components consume via
 * `useT()` (and `useLocale()` for the raw locale value).
 */
import { createContext, type ReactNode } from 'react'
import { getT } from './t'
import type { Locale } from './config'

export interface I18nContextValue {
  t: ReturnType<typeof getT>
  locale: Locale
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getT(locale)
  return <I18nContext.Provider value={{ t, locale }}>{children}</I18nContext.Provider>
}
