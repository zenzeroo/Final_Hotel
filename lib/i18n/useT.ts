'use client'

/**
 * Phase 26 mini — client-side translation hook.
 *
 * Throws if used outside an `<I18nProvider>` so missing setup is loud
 * during development rather than silently rendering untranslated
 * strings.
 */
import { useContext } from 'react'
import { I18nContext } from './I18nProvider'

export function useT() {
  const t = useContext(I18nContext)
  if (!t) {
    throw new Error('useT() must be used inside <I18nProvider>')
  }
  return t
}
