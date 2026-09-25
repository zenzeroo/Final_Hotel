'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { requestPasswordResetAction, type RequestPasswordResetResult } from '@/app/actions/password-reset'
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
          <span>{t('auth.forgotPasswordPage.submitButton')}…</span>
        </>
      ) : (
        t('auth.forgotPasswordPage.submitButton')
      )}
    </button>
  )
}

/**
 * Phase 41 — forgot password form.
 *
 * UX note: regardless of whether the email exists in the system, we
 * always show the same generic success card. This prevents user
 * enumeration attacks (an attacker probing which emails are registered).
 */
export function ForgotPasswordForm() {
  const t = useT()
  const [state, formAction] = useActionState<RequestPasswordResetResult | null, FormData>(
    requestPasswordResetAction,
    null,
  )
  // Local "submitted" state — independent of action's ok/error since
  // both paths should show the same success card.
  const [submitted, setSubmitted] = useState(false)

  // Show success card if action returned ok OR if local submitted state
  // is set (covers the case where action result is lost across re-renders).
  const showSuccess = submitted || state?.ok === true
  const error = state && state.ok === false ? state.error : null

  if (showSuccess) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <div className="px-4 py-3 bg-success/10 border border-success/30 rounded-lg text-body-md text-on-surface">
          <div className="font-semibold text-success mb-1">
            {t('auth.forgotPasswordPage.successTitle')}
          </div>
          <div className="text-on-surface-variant">
            {state && 'message' in state && state.message
              ? state.message
              : 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว กรุณาตรวจสอบกล่องข้อความและคลิกลิงก์เพื่อดำเนินการต่อ'}
          </div>
        </div>
        <p className="text-caption text-on-surface-variant italic text-center">
          {t('auth.forgotPasswordPage.successSpam')}
        </p>
        <Link
          href="/login"
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 border border-primary text-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
        >
          {t('auth.forgotPasswordPage.backToLogin')}
        </Link>
      </div>
    )
  }

  return (
    <form
      action={async (formData) => {
        setSubmitted(true)
        await formAction(formData)
      }}
      className="flex flex-col gap-5"
    >
      {error && (
        <div
          role="alert"
          className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error"
        >
          {error}
        </div>
      )}

      {/* Email */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">{t('auth.email')}</span>
        <div className="relative">
          <MaterialIcon
            name="mail"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="email"
            name="email"
            placeholder={t('auth.emailPlaceholder')}
            required
            autoComplete="email"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

      <SubmitButton />
    </form>
  )
}
