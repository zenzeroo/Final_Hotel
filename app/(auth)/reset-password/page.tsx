import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { r2Url } from '@/lib/r2/publicUrl'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { ResetPasswordForm } from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  const t = getT(await getLocale())

  // The user must arrive here with an active session — set up by
  // /auth/callback when the email link exchanges the code. If the
  // session is missing (link expired, already used, never clicked),
  // show the "expired" card instead of the form.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen relative flex items-center justify-center px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-12">
        <BackgroundImage />
        <div className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) p-8 md:p-10">
          <Brand />
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-primary">
              {t('auth.resetPasswordPage.expiredTitle')}
            </h1>
            <p className="text-body-md text-on-surface-variant mt-2">
              {t('auth.resetPasswordPage.expiredBody')}
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            {t('auth.resetPasswordPage.requestNewLink')}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-12">
      <BackgroundImage />
      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) p-8 md:p-10">
        <Brand />
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-primary">
            {t('auth.resetPasswordPage.title')}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            {t('auth.resetPasswordPage.subtitle')}
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </main>
  )
}

function BackgroundImage() {
  return (
    <div className="absolute inset-0">
      <Image
        src={r2Url('hero/home-hero.webp')}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-primary/60 mix-blend-multiply" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-transparent to-primary/70" />
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      <span className="material-symbols-outlined text-primary" style={{ fontSize: '32px' }}>
        spa
      </span>
      <span className="font-display text-2xl font-bold text-primary">Zenzero Hotel</span>
    </div>
  )
}
