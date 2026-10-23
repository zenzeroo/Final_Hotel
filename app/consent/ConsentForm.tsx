'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { acceptConsentAction, type ConsentState } from '@/app/actions/consent'
import { signOut } from '@/app/actions/auth'
import { ConsentCheckboxes } from '@/components/consent/ConsentCheckboxes'
import { useT } from '@/lib/i18n/useT'

function Buttons() {
  const { pending } = useFormStatus()
  const t = useT()
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        type="submit"
        disabled={pending}
        className="flex-1 px-6 py-3 rounded-lg bg-primary text-on-primary text-body-md font-medium hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60"
      >
        {pending ? `${t('consent.accept')}…` : t('consent.accept')}
      </button>
      {/* formNoValidate: signing out must not require the terms checkbox. */}
      <button
        type="submit"
        formAction={signOut}
        formNoValidate
        disabled={pending}
        className="flex-1 px-6 py-3 rounded-lg border border-outline-variant text-body-md font-medium text-on-surface hover:bg-surface-container transition-colors duration-200 disabled:opacity-60"
      >
        {t('consent.signOut')}
      </button>
    </div>
  )
}

export function ConsentForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<ConsentState | null, FormData>(acceptConsentAction, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <ConsentCheckboxes />
      {state?.error && (
        <p role="alert" className="text-body-md text-error">
          {state.error}
        </p>
      )}
      <Buttons />
    </form>
  )
}
