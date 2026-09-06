import Link from 'next/link'
import { getSession } from '@/lib/supabase/getSession'
import { signOut } from '@/app/actions/auth'
import { MaterialIcon } from '../ui/MaterialIcon'
import { ScrollNavIsland } from './ScrollNavIsland'
import { UserDropdownMenu } from './UserDropdownMenu'
import { LanguageToggle } from './LanguageToggle'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export async function TopNavBar() {
  const session = await getSession()
  const isAuthed = Boolean(session)
  const locale = await getLocale()
  const t = getT(locale)

  return (
    <ScrollNavIsland>
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop)">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <Link
              href="/"
              className="font-display text-2xl font-bold text-primary tracking-tight"
            >
              Zenzero Hotel
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-8">
              <NavLink href="/">{t('nav.home')}</NavLink>
              <NavLink href="/rooms">{t('nav.rooms')}</NavLink>
              <NavLink href="/bookings">{t('nav.bookings')}</NavLink>
              <NavLink href="/about">{t('nav.about')}</NavLink>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-low transition-colors"
                aria-label={t('nav.notification')}
              >
                <MaterialIcon name="notifications" size={22} />
              </button>
              <LanguageToggle currentLocale={locale} />
              {isAuthed && session ? (
                session.role === 'user' ? (
                  <UserDropdownMenu session={session} />
                ) : (
                  <UserMenu session={session} t={t} />
                )
              ) : (
                <LoginButton label={t('nav.login')} />
              )}
            </div>
          </div>
        </div>
      </header>
    </ScrollNavIsland>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-md text-body-md text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      {children}
    </Link>
  )
}

function LoginButton({ label }: { label: string }) {
  return (
    <Link
      href="/login"
      className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-primary text-secondary font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
    >
      {label}
    </Link>
  )
}

function UserMenu({
  session,
  t,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
  t: ReturnType<typeof getT>
}) {
  const initials = (session.fullName ?? session.email)
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <span className="hidden md:inline-block text-body-md text-on-surface-variant">
        {session.fullName ?? 'ผู้ใช้'}
      </span>
      <Link
        href="/account/profile"
        aria-label={t('nav.greeting')}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-secondary font-semibold text-label-md hover:bg-primary-container transition-colors"
      >
        {initials || 'U'}
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <MaterialIcon name="logout" size={16} />
          {t('nav.logout')}
        </button>
      </form>
    </div>
  )
}
