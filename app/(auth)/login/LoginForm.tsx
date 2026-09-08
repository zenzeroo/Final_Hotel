'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { signIn, signInWithGoogle, type AuthState } from '@/app/actions/auth'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { GoogleLogo } from '@/components/ui/GoogleLogo'

interface LoginFormProps {
  next: string
  /**
   * Phase 14 — OAuth callback error (e.g. `?error=oauth_cancelled` after the
   * user closed the Google consent screen). Surfaces in the same red banner
   * as the email/password error. The page reads it from `searchParams.error`.
   */
  errorMessage?: string
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          กำลังเข้าสู่ระบบ…
        </>
      ) : (
        'เข้าสู่ระบบ'
      )}
    </button>
  )
}

export function LoginForm({ next, errorMessage }: LoginFormProps) {
  const [state, formAction] = useActionState<AuthState | null, FormData>(signIn, null)
  const [googleError, setGoogleError] = useState<string | undefined>()
  const [googlePending, startGoogleTransition] = useTransition()

  const handleGoogle = () => {
    startGoogleTransition(async () => {
      const result = await signInWithGoogle(next)
      // Success: `redirect()` throws server-side, Next.js navigates the
      // browser, `result` resolves as undefined — we never see it.
      // Failure: action returns { error } — surface in the form banner.
      if (result?.error) setGoogleError(result.error)
    })
  }

  const displayError = state?.error ?? errorMessage ?? googleError

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      {displayError && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {displayError}
        </div>
      )}

      {/* Email */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">อีเมล</span>
        <div className="relative">
          <MaterialIcon
            name="mail"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="email"
            name="email"
            placeholder="เช่น yourname@email.com"
            required
            autoComplete="email"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

      {/* Password */}
      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-label-md text-on-surface">รหัสผ่าน</span>
          <a
            href="#"
            className="text-caption text-primary px-1 py-0.5 rounded hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            ลืมรหัสผ่าน?
          </a>
        </div>
        <PasswordInput
          name="password"
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete="current-password"
        />
      </label>

      <SubmitButton />

      {/* Divider */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-outline-variant" />
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">หรือ</span>
        <div className="flex-1 h-px bg-outline-variant" />
      </div>

      {/* Social buttons */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googlePending}
        className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-medium text-on-surface hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {googlePending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin" />
            กำลังเชื่อมต่อกับ Google…
          </>
        ) : (
          <>
            <GoogleLogo />
            เข้าสู่ระบบด้วย Google
          </>
        )}
      </button>
    </form>
  )
}
