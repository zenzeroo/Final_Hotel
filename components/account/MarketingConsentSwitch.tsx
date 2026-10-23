'use client'

import { useState, useTransition } from 'react'
import { setMarketingConsentAction } from '@/app/actions/consent'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n/useT'

export function MarketingConsentSwitch({ initial }: { initial: boolean }) {
  const t = useT()
  const toast = useToast()
  const [on, setOn] = useState(initial)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !on
    startTransition(async () => {
      const result = await setMarketingConsentAction(next)
      if (result.ok) {
        setOn(next)
        toast.success(next ? t('consent.marketingOn') : t('consent.marketingOff'))
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-body-md text-on-surface">{t('consent.marketing')}</p>
        <p className="text-caption text-on-surface-variant">{t('consent.marketingProfileHint')}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t('consent.marketing')}
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${
          on ? 'bg-primary' : 'bg-outline-variant'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-surface-container-lowest transition-transform duration-200 ${
            on ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
