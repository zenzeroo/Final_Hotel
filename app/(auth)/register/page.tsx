import Image from 'next/image'
import Link from 'next/link'
import { r2Url } from '@/lib/r2/publicUrl'
import { RegisterForm } from './RegisterForm'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export default async function RegisterPage(props: PageProps<'/register'>) {
  const searchParams = await props.searchParams
  const t = getT(await getLocale())
  const next = typeof searchParams.next === 'string' ? searchParams.next : '/'
  // Phase 14 — surface OAuth callback failures into the form banner.
  const errorMessage = mapOAuthError(searchParams.error, t)
  // Phase 26 — show the "check your email" modal after the user
  // submits signUp while email confirmation is required.
  const showCheckEmailModal = mapInfoMessage(searchParams.message) === 'check_email'

  return (
    <main className="min-h-screen relative flex items-center justify-center px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-12">
      {/* Background image */}
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
          <h1 className="font-display text-3xl font-bold text-primary">{t('auth.registerTitle')}</h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            {t('auth.registerSubtitle')}
          </p>
        </div>

        <RegisterForm
          next={next}
          errorMessage={errorMessage}
          showCheckEmailModal={showCheckEmailModal}
        />

        <p className="mt-8 text-center text-body-md text-on-surface-variant">
          {t('auth.haveAccount')}{' '}
          <Link
            href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="text-primary px-2 py-1 rounded font-semibold hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            {t('nav.login')}
          </Link>
        </p>
      </div>
    </main>
  )
}

/** Phase 14 — same mapping as LoginPage. */
function mapOAuthError(
  error: string | string[] | undefined,
  t: ReturnType<typeof getT>,
): string | undefined {
  const value = Array.isArray(error) ? error[0] : error
  switch (value) {
    case 'oauth_cancelled':
      return 'oauth_cancelled' === value ? t('auth.signUp') + ' (cancelled)' : undefined
    case 'oauth_failed':
      return 'oauth_failed' === value ? t('auth.signUp') + ' (failed)' : undefined
    default:
      return undefined
  }
}

/**
 * Phase 26 — map `?message=` to a marker string. Returns the literal
 * 'check_email' when the user just submitted signUp while Supabase
 * email confirmation is enabled, so the calling page can decide to
 * mount the CheckEmailModal.
 */
function mapInfoMessage(
  message: string | string[] | undefined,
): string | undefined {
  const value = Array.isArray(message) ? message[0] : message
  switch (value) {
    case 'check_email':
      return 'check_email'
    default:
      return undefined
  }
}
