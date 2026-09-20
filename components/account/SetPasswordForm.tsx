'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  setPasswordForOAuthOnlyAction,
  type AccountIdentityActionResult,
} from '@/app/actions/identity-link'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

function SubmitButton({ locale }: { locale: 'th' | 'en' }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-on-primary px-6 py-2 rounded-full font-label-md text-label-md hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60 flex items-center gap-2"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          {locale === 'en' ? 'Saving…' : 'กำลังบันทึก…'}
        </>
      ) : locale === 'en' ? (
        'Set password'
      ) : (
        'ตั้งรหัสผ่าน'
      )}
    </button>
  )
}

/**
 * Phase 37 — "Set a password" form for Google-only accounts.
 * No currentPassword field — server action calls admin.updateUserById()
 * which bypasses the "require recent login" gate (admin client is
 * already privileged).
 */
export function SetPasswordForm({ locale }: { locale: 'th' | 'en' }) {
  const labels = {
    newPassword:
      locale === 'en' ? 'New password (at least 8 characters)' : 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)',
    confirm: locale === 'en' ? 'Confirm new password' : 'พิมพ์รหัสผ่านใหม่อีกครั้ง',
  }

  const wrapped = async (
    _state: AccountIdentityActionResult | null,
    formData: FormData,
  ): Promise<AccountIdentityActionResult> => {
    return await setPasswordForOAuthOnlyAction(null, formData)
  }

  const [state, formAction] = useActionState<AccountIdentityActionResult | null, FormData>(
    wrapped,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && !state.ok && state.error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-sm text-error inline-flex items-start gap-2">
          <MaterialIcon name="error_outline" size={18} className="flex-shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}
      {state && state.ok && (
        <div className="px-4 py-3 bg-secondary-container text-on-secondary-container rounded-lg text-body-md inline-flex items-center gap-2">
          <MaterialIcon name="check_circle" size={18} />
          {locale === 'en' ? 'Password set successfully' : 'ตั้งรหัสผ่านสำเร็จ'}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <PasswordInput
          name="newPassword"
          placeholder={labels.newPassword}
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        <PasswordInput
          name="confirmPassword"
          placeholder={labels.confirm}
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
      </div>
      <div className="flex justify-end">
        <SubmitButton locale={locale} />
      </div>
    </form>
  )
}
