'use client'

/**
 * Phase 26 mini — client-side locale context.
 *
 * Server components should use `getLocale()` + `getT()` directly.
 * This context is for the small client-component subtree that needs to
 * render translated strings (forms, dropdowns). The provider is mounted
 * once near the root of the tree, and child components consume via
 * `useT()` from `useT.ts`.
 */
import { createContext, type ReactNode } from 'react'
import { getT } from './t'
import type { Locale } from './config'

export const I18nContext = createContext<ReturnType<typeof getT> | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={getT(locale)}>{children}</I18nContext.Provider>
}
