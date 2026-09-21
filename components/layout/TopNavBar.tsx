import Link from 'next/link'
import { getSession } from '@/lib/supabase/getSession'
import { signOut } from '@/app/actions/auth'
import { MaterialIcon } from '../ui/MaterialIcon'
import { r2Url } from '@/lib/r2/publicUrl'
import { ScrollNavIsland } from './ScrollNavIsland'
import { UserDropdownMenu } from './UserDropdownMenu'
import { LanguageToggle } from './LanguageToggle'
import { NavLink } from './NavLink'
import { MobileNavMenu } from './MobileNavMenu'
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

            {/* Nav Links (desktop only) — gap-4 instead of gap-8 keeps
                the actions cluster from being squeezed off the right
                edge when EN labels are longer ("My Bookings" vs TH
                "ประวัติการจอง"). */}
            <nav className="hidden md:flex items-center gap-4">
              <NavLink href="/">{t('nav.home')}</NavLink>
              <NavLink href="/rooms">{t('nav.rooms')}</NavLink>
              <NavLink href="/bookings">{t('nav.bookings')}</NavLink>
              <NavLink href="/about">{t('nav.about')}</NavLink>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              {/* Mobile hamburger trigger */}
              <MobileNavMenu
                isAuthed={isAuthed}
                role={session?.role ?? 'user'}
                locale={locale}
                labels={{
                  home: t('nav.home'),
                  rooms: t('nav.rooms'),
                  bookings: t('nav.bookings'),
                  about: t('nav.about'),
                  login: t('nav.login'),
                  logout: t('nav.logout'),
                  greeting: t('nav.greeting'),
                  notification: t('nav.notification'),
                  menu: 'เมนู',
                  menuAriaLabel: 'เปิดเมนู',
                }}
              />

              {/* Desktop notification button */}
              <button
                className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-primary-fixed transition-colors"
                aria-label={t('nav.notification')}
              >
                <MaterialIcon name="notifications" size={22} />
              </button>

              {/* Language toggle */}
              <LanguageToggle currentLocale={locale} />

              {/* Auth controls — desktop full menu; mobile uses icon-only in MobileNavMenu */}
              <div className="hidden md:flex items-center gap-4">
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
        </div>
      </header>
    </ScrollNavIsland>
  )
}

function LoginButton({ label }: { label: string }) {
  return (
    <Link
      href="/login"
      title={label}
      className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-primary text-on-primary font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors min-w-[120px] whitespace-nowrap"
    >
      <span className="truncate">{label}</span>
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
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-on-primary font-semibold text-label-md hover:bg-primary-container transition-colors overflow-hidden"
      >
        {session.avatarKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r2Url(session.avatarKey)}
            alt={session.fullName ?? 'avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          initials || 'U'
        )}
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          title={t('nav.logout')}
          className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-label-md text-on-surface hover:bg-primary-fixed hover:text-primary transition-colors min-w-[120px] justify-center whitespace-nowrap"
        >
          <MaterialIcon name="logout" size={16} className="flex-shrink-0" />
          <span className="truncate">{t('nav.logout')}</span>
        </button>
      </form>
    </div>
  )
}
