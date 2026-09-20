'use client'

import { useActionState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import {
  startLinkGoogleIdentityAction,
  type AccountIdentityActionResult,
} from '@/app/actions/identity-link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { GoogleLogo } from '@/components/ui/GoogleLogo'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-medium text-on-surface hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin" />
          กำลังเชื่อมต่อ…
        </>
      ) : (
        <>
          <GoogleLogo />
          <span>เชื่อมต่อบัญชี Google</span>
        </>
      )}
    </button>
  )
}

/**
 * Phase 37 — "Connect Google" button. Wraps the server action
 * startLinkGoogleIdentityAction which calls supabase.auth.linkIdentity()
 * and redirects to Google's consent screen.
 *
 * Uses a separate useTransition for the click handler so the form-action
 * pending state doesn't cascade into the button label.
 */
export function ConnectGoogleButton() {
  const [state, formAction] = useActionState<AccountIdentityActionResult | null, FormData>(
    startLinkGoogleIdentityAction,
    null,
  )
  const [, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <form
        action={(fd) => {
          startTransition(() => formAction(fd))
        }}
      >
        <SubmitButton />
      </form>
      {state && !state.ok && state.error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-sm text-error inline-flex items-start gap-2">
          <MaterialIcon name="error_outline" size={18} className="flex-shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  )
}
