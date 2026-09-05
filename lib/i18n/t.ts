/**
 * Phase 26 mini — server-side dictionary lookup.
 *
 * Usage in a server component:
 *   const locale = await getLocale()
 *   const t = getT(locale)
 *   <h1>{t('home.heroTitle')}</h1>
 *
 * Placeholders use `{name}` syntax, e.g. `t('roomsList.resultsCount', { count: 5 })`.
 * Falls back to the key itself when a string is missing (dev-friendly —
 * no crash, just visible "namespace.key" text in the UI).
 */
import { en } from './dictionaries/en'
import { th } from './dictionaries/th'
import type { Locale } from './config'

const DICTS = { th, en } as const

/**
 * Recursively widen all string leaves to plain `string`. Lets `en.ts`
 * and `th.ts` share the same KEY shape (for type-safe `t('foo.bar')`)
 * while holding different VALUES.
 */
export type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T

export type TKey = DeepJoin<Widen<typeof th>, '', []>

type DeepJoin<T, Prefix extends string> = {
  [K in keyof T]: T[K] extends string
    ? `${Prefix}${string & K}`
    : T[K] extends object
      ? DeepJoin<T[K], `${Prefix}${string & K}.`>
      : never
}[keyof T]

/** Server helper: `t(locale, 'home.heroTitle')` or `t(locale, 'roomsList.resultsCount', { count: 5 })`. */
export function getT(locale: Locale) {
  const dict = DICTS[locale] as Widen<typeof th>
  return function t(key: string, params?: Record<string, string | number>): string {
    const value = readKey(dict, key)
    if (typeof value !== 'string') return key // missing key — surface it for dev
    if (!params) return value
    return value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
  }
}

function readKey(obj: unknown, dotted: string): unknown {
  const parts = dotted.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}
