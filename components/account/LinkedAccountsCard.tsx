import { getMyLinkedIdentities } from '@/app/actions/identity-link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { ConnectGoogleButton } from './ConnectGoogleButton'
import { UnlinkIdentityButton } from './UnlinkIdentityButton'
import { SetPasswordForm } from './SetPasswordForm'

/**
 * Phase 37 — Server-rendered "Login methods" card on /account/profile.
 *
 * Lists all auth identities linked to the current user (email + Google),
 * showing verified status + allowing Add / Remove actions.
 *
 * Reads:
 *   - getMyLinkedIdentities() — auth.users.identities list
 *   - searchParams.linked / searchParams.link_error — flash banner from
 *     the post-OAuth-callback redirect (auth/callback/route.ts).
 *
 * Renders:
 *   - "Email/Password" row + Google row (✓ connected or "not connected")
 *   - "Add a sign-in method" section with the connect buttons OR
 *     "Set a password" form (for Google-only users)
 *   - Flash banner at top if `?linked=google` is in URL
 */
export async function LinkedAccountsCard({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; link_error?: string }>
}) {
  const sp = await searchParams
  const [identities, locale] = await Promise.all([
    getMyLinkedIdentities(),
    getLocale(),
  ])
  const t = getT(locale)

  const hasEmail = identities.some((i) => i.provider === 'email')
  const hasGoogle = identities.some((i) => i.provider === 'google')

  const linkedJustNow = sp.linked === 'google'
  const linkCancelled = sp.link_error === 'cancelled'

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container">
      <div className="p-gutter md:p-[32px] pb-base">
        <h3 className="font-headline-sm text-headline-sm text-primary">
          {t('profile.loginMethods')}
        </h3>
        <p className="text-on-surface-variant text-body-md mt-1">
          {t('profile.loginMethodsSubtitle')}
        </p>
      </div>

      {linkedJustNow && hasGoogle && (
        <div className="mx-gutter md:mx-[32px] mb-base px-4 py-3 bg-secondary-container text-on-secondary-container rounded-lg text-body-md inline-flex items-center gap-2">
          <MaterialIcon name="check_circle" size={18} />
          {t('profile.linkSuccess').replace(
            '{method}',
            t('profile.googleConnected'),
          )}
        </div>
      )}
      {linkCancelled && (
        <div className="mx-gutter md:mx-[32px] mb-base px-4 py-3 bg-surface-container text-on-surface-variant rounded-lg text-body-md inline-flex items-center gap-2">
          <MaterialIcon name="info" size={18} />
          {t('profile.linkCancelled')}
        </div>
      )}

      <div className="px-gutter md:px-[32px] pb-base flex flex-col gap-gutter">
        {/* Email/Password row */}
        <div className="flex items-center justify-between gap-3 py-3 border-b border-surface-container">
          <div className="flex items-center gap-3 min-w-0">
            <MaterialIcon
              name="mail"
              size={24}
              className="text-primary flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                {t('profile.emailPasswordConnected')}
                {hasEmail && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-caption text-caption">
                    <MaterialIcon name="verified" size={12} />
                    {t('profile.verifiedBadge')}
                  </span>
                )}
              </div>
              <div className="text-caption text-on-surface-variant truncate">
                {hasEmail
                  ? (identities.find((i) => i.provider === 'email')?.email ??
                    '')
                  : t('profile.notConnected')}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            {/* Email/password row has no remove button (see AccountSecuritySection for password editing instead) */}
          </div>
        </div>

        {/* Google row */}
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <MaterialIcon
              name="account_circle"
              size={24}
              className="text-primary flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                {t('profile.googleConnected')}
                {hasGoogle && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-caption text-caption">
                    <MaterialIcon name="verified" size={12} />
                    {t('profile.verifiedBadge')}
                  </span>
                )}
              </div>
              <div className="text-caption text-on-surface-variant truncate">
                {hasGoogle
                  ? (identities.find((i) => i.provider === 'google')?.email ??
                    '')
                  : t('profile.notConnected')}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            {hasGoogle && (
              <UnlinkIdentityButton
                identityId={
                  identities.find((i) => i.provider === 'google')!.identityId
                }
                methodLabel={t('profile.googleConnected')}
                locale={locale}
                key={identities.find((i) => i.provider === 'google')?.identityId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Add a sign-in method OR Set a password for Google-only */}
      <div className="px-gutter md:px-[32px] pb-gutter md:pb-[32px] pt-base border-t border-surface-container">
        <h4 className="font-label-lg text-label-lg text-on-surface mb-3">
          {t('profile.addLoginMethod')}
        </h4>
        <div className="flex flex-col gap-gutter">
          {!hasGoogle && <ConnectGoogleButton />}

          {!hasEmail && hasGoogle && (
            <div className="bg-surface-container-low rounded-xl p-gutter md:p-[24px] border border-surface-container">
              <div className="flex items-center gap-2 mb-3">
                <MaterialIcon name="lock" size={20} className="text-primary" />
                <span className="font-label-md text-label-md text-on-surface">
                  {t('profile.setPassword')}
                </span>
              </div>
              <SetPasswordForm locale={locale} />
            </div>
          )}

          {hasEmail && hasGoogle && (
            <p className="text-body-sm text-on-surface-variant">
              {/* All methods connected — nothing to add. Keep the heading
                  visible so the user knows where to look if they want to. */}
              {/* (empty state) */}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
