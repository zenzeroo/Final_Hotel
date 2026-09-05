/**
 * Phase 26 mini — resolve the active locale on the server.
 *
 * Precedence (per plan):
 *   1. `NEXT_LOCALE` cookie          — explicit user choice
 *   2. `profiles.locale`            — authed user's saved preference
 *   3. `hotel_settings.locale_default` — hotel-level admin default
 *   4. `DEFAULT_LOCALE` ('th')       — final fallback
 */
import { cookies } from 'next/headers'
import { getSession } from '@/lib/supabase/getSession'
import { getOwnProfile } from '@/lib/data/account'
import { getHotelSettings } from '@/lib/data/manager'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  toLocale,
} from './config'

/**
 * Server-only. Returns the locale that should drive rendering for the
 * current request. Safe to call multiple times per render — it's a
 * pure read against cookies + cached Supabase clients.
 */
export async function getLocale(): Promise<Locale> {
  // 1. Explicit cookie choice (set by setLocaleAction).
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  if (fromCookie) return toLocale(fromCookie)

  // 2. Authed user's saved preference.
  const session = await getSession()
  if (session) {
    const profile = await getOwnProfile()
    if (profile?.locale) return toLocale(profile.locale)
  }

  // 3. Hotel-level default configured in hotel_settings.
  try {
    const settings = await getHotelSettings()
    if (settings?.locale_default) return toLocale(settings.locale_default)
  } catch {
    // If hotel_settings is missing or the RPC fails, fall through.
  }

  // 4. Final fallback.
  return DEFAULT_LOCALE
}
