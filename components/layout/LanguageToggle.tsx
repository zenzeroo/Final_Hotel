'use client'

/**
 * Phase 26 mini — client-side language toggle.
 *
 * Two `<form action={setLocaleAction}>` wrappers (one per locale) so
 * the user click is a real form submit (server action handles cookie +
 * profile.locale write + revalidatePath). The active locale is rendered
 * with `aria-pressed` + bolder weight.
 *
 * `tone="light"` (default, TopNavBar) is hidden on mobile
 * (`hidden md:inline-flex`); `tone="dark"` is for the dark staff sidebar,
 * which is also the mobile menu, so it is always shown.
 */
import { useFormStatus } from 'react-dom'
import { setLocaleAction } from '@/app/actions/locale'
import type { Locale } from '@/lib/i18n/config'

type Tone = 'light' | 'dark'

interface LanguageToggleProps {
  currentLocale: Locale
  tone?: Tone
}

const BUTTON_TONE: Record<Tone, { active: string; inactive: string }> = {
  light: {
    active: 'bg-primary text-on-primary font-semibold',
    inactive: 'text-on-surface-variant hover:bg-primary-fixed hover:text-primary disabled:opacity-100',
  },
  dark: {
    active: 'bg-secondary text-primary font-semibold',
    inactive: 'text-secondary/80 hover:bg-primary-container hover:text-on-primary disabled:opacity-100',
  },
}

export function LanguageToggle({ currentLocale, tone = 'light' }: LanguageToggleProps) {
  return (
    <div
      className={`${tone === 'light' ? 'hidden md:inline-flex' : 'inline-flex'} items-center gap-1 text-label-md`}
    >
      <LocaleButton active={currentLocale === 'th'} locale="th" label="TH" tone={tone} />
      <span className={tone === 'light' ? 'text-outline-variant' : 'text-secondary/40'} aria-hidden>
        |
      </span>
      <LocaleButton active={currentLocale === 'en'} locale="en" label="EN" tone={tone} />
    </div>
  )
}

function LocaleButton({
  active,
  locale,
  label,
  tone,
}: {
  active: boolean
  locale: Locale
  label: string
  tone: Tone
}) {
  return (
    <form action={setLocaleAction} className="contents">
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton active={active} label={label} tone={tone} />
    </form>
  )
}

function SubmitButton({ active, label, tone }: { active: boolean; label: string; tone: Tone }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={active || pending}
      aria-pressed={active}
      aria-label={label === 'TH' ? 'ภาษาไทย' : 'English'}
      className={`min-w-[44px] inline-flex items-center justify-center px-2 py-1 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary rounded ${
        active ? BUTTON_TONE[tone].active : BUTTON_TONE[tone].inactive
      }`}
    >
      {label}
    </button>
  )
}
