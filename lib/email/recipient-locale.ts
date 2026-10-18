/**
 * Phase 27.D — the language a transactional email should be written in.
 *
 * Emails go to the GUEST, but most are fired from a staff action
 * (check-out, refund approval, cash payment) or a Stripe webhook (no
 * session at all), so `getLocale()` — which reads the current request's
 * cookie / profile — would pick the wrong person. This resolves the
 * guest's own preference instead:
 *
 *   profiles.locale (of the booking owner) → hotel_settings.locale_default → 'th'
 *
 * Never throws: a lookup failure must not block an email.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n/config'

function asLocale(value: unknown): Locale | null {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : null
}

export async function getRecipientLocale(args: {
  userId?: string | null
  bookingId?: string | null
}): Promise<Locale> {
  try {
    const admin = await createAdminClient()

    let userId = args.userId ?? null
    if (!userId && args.bookingId) {
      const { data } = await admin
        .from('bookings')
        .select('user_id')
        .eq('id', args.bookingId)
        .maybeSingle()
      userId = (data?.user_id as string | null | undefined) ?? null
    }

    if (userId) {
      const { data } = await admin.from('profiles').select('locale').eq('id', userId).maybeSingle()
      const fromProfile = asLocale(data?.locale)
      if (fromProfile) return fromProfile
    }

    const { data: settings } = await admin
      .from('hotel_settings')
      .select('locale_default')
      .eq('id', 1)
      .maybeSingle()
    return asLocale(settings?.locale_default) ?? DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}
