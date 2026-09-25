import Image from 'next/image'
import Link from 'next/link'
import { r2Url } from '@/lib/r2/publicUrl'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export default async function ForgotPasswordPage() {
  const t = getT(await getLocale())

  return (
    <main className="min-h-screen relative flex items-center justify-center px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-12">
      {/* Background image (matches /login for visual continuity) */}
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

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) p-8 md:p-10">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '32px' }}>
            spa
          </span>
          <span className="font-display text-2xl font-bold text-primary">Zenzero Hotel</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-primary">
            {t('auth.forgotPasswordPage.title')}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            {t('auth.forgotPasswordPage.subtitle')}
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="mt-8 text-center text-body-md text-on-surface-variant">
          <Link
            href="/login"
            className="text-primary px-2 py-1 rounded font-semibold hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            {t('auth.forgotPasswordPage.backToLogin')}
          </Link>
        </p>
      </div>
    </main>
  )
}
