'use server'

/**
 * Phase 61 — PDPA consent actions.
 *
 *  - acceptConsentAction: the /consent page (Google sign-ups, members who
 *    joined before consent existed, and everyone after a policy version bump).
 *  - setMarketingConsentAction: the marketing switch on /account/profile.
 *
 * The user id always comes from the session, never from the form.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/supabase/getSession'
import { recordConsent } from '@/lib/data/account'
import { PRIVACY_POLICY_VERSION } from '@/lib/consent'
import { sanitizeNext } from '@/lib/auth/sanitize'
import { getServerT } from '@/lib/i18n/server'
import { actionFail } from '@/lib/errors/supabase'

export interface ConsentState {
  error?: string
}

export async function acceptConsentAction(
  _prev: ConsentState | null,
  formData: FormData,
): Promise<ConsentState> {
  const { t } = await getServerT()
  const session = await getSession()
  if (!session) redirect('/login?next=/consent')

  if (formData.get('accept_terms') !== 'on') {
    return { error: t('validation.acceptTerms') }
  }
  const marketing = formData.get('marketing_opt_in') === 'on'

  try {
    await recordConsent(session.id, {
      termsVersion: PRIVACY_POLICY_VERSION,
      marketing,
      source: 'consent_page',
      version: PRIVACY_POLICY_VERSION,
    })
  } catch (e) {
    return { error: actionFail(e, t('consent.saveFailed')).error }
  }

  revalidatePath('/', 'layout')
  redirect(sanitizeNext(String(formData.get('next') ?? '/')))
}

export async function setMarketingConsentAction(
  optIn: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { t } = await getServerT()
  const session = await getSession()
  if (!session) return { ok: false, error: t('actions.common.notLoggedIn') }

  try {
    await recordConsent(session.id, {
      marketing: optIn,
      source: 'profile',
      version: session.termsVersion ?? PRIVACY_POLICY_VERSION,
    })
  } catch (e) {
    return actionFail(e, t('consent.saveFailed'))
  }
  revalidatePath('/account/profile')
  return { ok: true }
}
