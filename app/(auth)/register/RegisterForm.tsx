'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { signUp, signInWithGoogle, type AuthState } from '@/app/actions/auth'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { GoogleLogo } from '@/components/ui/GoogleLogo'

interface RegisterFormProps {
  next: string
  /**
   * Phase 14 — OAuth callback error surfaced from `?error=` in the URL.
   * Same display path as the email/password error above.
   */
  errorMessage?: string
  /**
   * Phase 26 — info banner surfaced from `?message=` in the URL when
   * the signUp server action redirects back here (e.g. `check_email`
   * when Supabase email confirmation is enabled).
   */
  infoMessage?: string
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          กำลังสมัครสมาชิก…
        </>
      ) : (
        'สมัครสมาชิก'
      )}
    </button>
  )
}

export function RegisterForm({ next, errorMessage, infoMessage }: RegisterFormProps) {
  const [state, formAction] = useActionState<AuthState | null, FormData>(signUp, null)
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
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {displayError && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {displayError}
        </div>
      )}

      {/* Phase 26 — info banner for bounced signUp (e.g. check_email). */}
      {infoMessage && (
        <div className="px-4 py-3 bg-secondary-container text-on-secondary-container rounded-lg text-body-md inline-flex items-start gap-2">
          <MaterialIcon name="mark_email_read" className="mt-0.5 shrink-0" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Full name */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">ชื่อ-นามสกุล</span>
        <div className="relative">
          <MaterialIcon
            name="person"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            name="full_name"
            placeholder="คุณสมชาย ใจดี"
            required
            autoComplete="name"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

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

      {/* Phone */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">
          เบอร์โทรศัพท์ <span className="text-on-surface-variant normal-case font-normal">(ไม่บังคับ)</span>
        </span>
        <div className="relative">
          <MaterialIcon
            name="phone"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="tel"
            name="phone"
            placeholder="08X-XXX-XXXX"
            autoComplete="tel"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

      {/* Password */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">รหัสผ่าน</span>
        <PasswordInput
          name="password"
          placeholder="อย่างน้อย 8 ตัวอักษร"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>

      {/* Confirm password */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">ยืนยันรหัสผ่าน</span>
        <PasswordInput
          name="confirm_password"
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>

      <SubmitButton />

      {/* Divider */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-outline-variant" />
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">หรือ</span>
        <div className="flex-1 h-px bg-outline-variant" />
      </div>

      {/* Google signup — same handler as LoginForm. OAuth doesn't distinguish
          sign-in vs sign-up; the callback route handles both (existing email
          → sign-in, new email → trigger creates profile with role='user'). */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googlePending}
        className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-medium text-on-surface hover:bg-surface-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {googlePending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin" />
            กำลังเชื่อมต่อกับ Google…
          </>
        ) : (
          <>
            <GoogleLogo />
            สมัครสมาชิกด้วย Google
          </>
        )}
      </button>
    </form>
  )
}
