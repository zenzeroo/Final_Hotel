/**
 * Phase 27.C — one-call locale + translator for server actions / route
 * handlers. Uses the full `getLocale()` precedence (cookie → profile →
 * hotel default → 'th').
 *
 *   const { locale, t } = await getServerT()
 *   return { error: t('actions.common.notLoggedIn') }
 *
 * Do NOT use this to pick the language of an email sent to a guest from a
 * staff/webhook context — that is the guest's locale, see
 * `lib/email/recipient-locale.ts`.
 */
import { getLocale } from './getLocale'
import { getT } from './t'
import type { Locale } from './config'

export type ServerT = ReturnType<typeof getT>

export async function getServerT(): Promise<{ locale: Locale; t: ServerT }> {
  const locale = await getLocale()
  return { locale, t: getT(locale) }
}
