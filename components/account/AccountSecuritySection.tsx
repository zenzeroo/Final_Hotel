import { getHasPasswordIdentity } from '@/app/actions/identity-link'
import { ChangePasswordForm } from './ChangePasswordForm'
import { SetPasswordForm } from './SetPasswordForm'
import { getLocale } from '@/lib/i18n/getLocale'

/**
 * Phase 37 — Replaces the standalone ChangePasswordForm on the profile
 * page. Branches between "change password" (existing email/password
 * identity) and "set a password" (Google-only accounts).
 *
 * The existing ChangePasswordForm requires the CURRENT password for
 * verification before allowing a change — that flow doesn't apply when
 * the user has no password at all. SetPasswordForm uses the admin client
 * to set a fresh password without verifying an old one.
 */
export async function AccountSecuritySection() {
  const [hasPassword, locale] = await Promise.all([
    getHasPasswordIdentity(),
    getLocale(),
  ])

  if (hasPassword) {
    return <ChangePasswordForm />
  }

  // Google-only account (or any account without an email identity) — show
  // the "set password" form instead. No current-password verification
  // needed since the admin client sets the password directly.
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container">
      <div className="p-gutter md:p-[32px] pb-base">
        <h3 className="font-headline-sm text-headline-sm text-primary">
          {locale === 'en' ? 'Security' : 'ความปลอดภัย'}
        </h3>
        <p className="text-on-surface-variant text-body-md mt-1">
          {locale === 'en'
            ? 'Add a password so you can also sign in with email + password.'
            : 'ตั้งรหัสผ่านเพื่อให้คุณสามารถเข้าสู่ระบบด้วยอีเมล + รหัสผ่านได้ด้วย'}
        </p>
      </div>
      <div className="px-gutter md:px-[32px] pb-gutter md:pb-[32px]">
        <SetPasswordForm locale={locale} />
      </div>
    </div>
  )
}
