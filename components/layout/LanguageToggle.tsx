'use client'

/**
 * Phase 26 mini — client-side language toggle.
 *
 * Two `<form action={setLocaleAction}>` wrappers (one per locale) so
 * the user click is a real form submit (server action handles cookie +
 * profile.locale write + revalidatePath). The active locale is rendered
 * with `aria-pressed` + bolder weight.
 *
 * The toggle is hidden on mobile (`hidden md:inline-flex`) — the
 * existing TopNavBar visibility rule. A future mobile menu can mount
 * this same component there.
 */
import { useFormStatus } from 'react-dom'
import { setLocaleAction } from '@/app/actions/locale'
import type { Locale } from '@/lib/i18n/config'

interface LanguageToggleProps {
  currentLocale: Locale
}

export function LanguageToggle({ currentLocale }: LanguageToggleProps) {
  return (
    <div className="hidden md:inline-flex items-center gap-1 text-label-md">
      <LocaleButton active={currentLocale === 'th'} locale="th" label="TH" />
      <span className="text-outline-variant">|</span>
      <LocaleButton active={currentLocale === 'en'} locale="en" label="EN" />
    </div>
  )
}

function LocaleButton({
  active,
  locale,
  label,
}: {
  active: boolean
  locale: Locale
  label: string
}) {
  return (
    <form action={setLocaleAction} className="contents">
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton active={active} label={label} />
    </form>
  )
}

function SubmitButton({ active, label }: { active: boolean; label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={active || pending}
      aria-pressed={active}
      aria-label={label === 'TH' ? 'ภาษาไทย' : 'English'}
      className={
        active
          ? 'px-2 py-1 text-primary font-semibold'
          : 'px-2 py-1 text-on-surface-variant hover:text-primary disabled:opacity-100'
      }
    >
      {label}
    </button>
  )
}
