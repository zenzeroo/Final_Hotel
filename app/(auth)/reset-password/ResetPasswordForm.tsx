'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { resetPasswordAction, type ResetPasswordResult } from '@/app/actions/password-reset'
import { useT } from '@/lib/i18n/useT'

function SubmitButton() {
  const { pending } = useFormStatus()
  const t = useT()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          <span>{t('auth.resetPasswordPage.submitButton')}…</span>
        </>
      ) : (
        t('auth.resetPasswordPage.submitButton')
      )}
    </button>
  )
}

/**
 * Phase 41 — reset password form.
 *
 * Calls resetPasswordAction → supabase.auth.updateUser({ password }).
 * On success, redirects to /login with a success message flag. The
 * login page can show a banner if it detects the flag.
 */
export function ResetPasswordForm() {
  const t = useT()
  const router = useRouter()
  const [state, formAction] = useActionState<ResetPasswordResult | null, FormData>(
    resetPasswordAction,
    null,
  )

  // When the action returns ok: true, navigate to /login with a
  // success flag the login page can read (Phase 41 follow-up).
  useEffect(() => {
    if (state?.ok === true) {
      router.push('/login?success=password_reset')
    }
  }, [state, router])

  const error = state && state.ok === false ? state.error : null

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {error && (
        <div
          role="alert"
          className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error"
        >
          {error}
        </div>
      )}

      {/* New password */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">
          {t('auth.resetPasswordPage.newPasswordLabel')}
        </span>
        <div className="relative">
          <MaterialIcon
            name="lock"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant z-10"
          />
          <PasswordInput
            name="newPassword"
            placeholder={t('auth.passwordPlaceholder')}
            required
            minLength={8}
            autoComplete="new-password"
            className="pl-10"
          />
        </div>
      </label>

      {/* Confirm new password */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">
          {t('auth.resetPasswordPage.confirmPasswordLabel')}
        </span>
        <div className="relative">
          <MaterialIcon
            name="lock_reset"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant z-10"
          />
          <PasswordInput
            name="confirmNewPassword"
            placeholder={t('auth.passwordPlaceholder')}
            required
            minLength={8}
            autoComplete="new-password"
            className="pl-10"
          />
        </div>
      </label>

      <SubmitButton />
    </form>
  )
}
