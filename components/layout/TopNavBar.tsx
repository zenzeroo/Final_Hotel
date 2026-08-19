import Link from 'next/link'
import { getSession } from '@/lib/supabase/getSession'
import { signOut } from '@/app/actions/auth'
import { MaterialIcon } from '../ui/MaterialIcon'
import { ScrollNavIsland } from './ScrollNavIsland'

export async function TopNavBar() {
  const session = await getSession()
  const isAuthed = Boolean(session)

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
              <NavLink href="/">หน้าแรก</NavLink>
              <NavLink href="/rooms">ห้องพัก</NavLink>
              <NavLink href="/bookings">ประวัติการจอง</NavLink>
              <NavLink href="/about">เกี่ยวกับโรงแรม</NavLink>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-low transition-colors"
                aria-label="การแจ้งเตือน"
              >
                <MaterialIcon name="notifications" size={22} />
              </button>
              <LanguageToggle />
              {isAuthed && session ? <UserMenu session={session} /> : <LoginButton />}
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
      className="text-body-md text-on-surface hover:text-primary transition-colors"
    >
      {children}
    </Link>
  )
}

function LanguageToggle() {
  return (
    <div className="hidden md:inline-flex items-center gap-1 text-label-md">
      <button className="px-2 py-1 text-primary font-semibold" aria-label="ภาษาไทย">
        TH
      </button>
      <span className="text-outline-variant">|</span>
      <button className="px-2 py-1 text-on-surface-variant hover:text-primary" aria-label="English">
        EN
      </button>
    </div>
  )
}

function LoginButton() {
  return (
    <Link
      href="/login"
      className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-primary text-secondary font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
    >
      เข้าสู่ระบบ
    </Link>
  )
}

function UserMenu({ session }: { session: NonNullable<Awaited<ReturnType<typeof getSession>>> }) {
  const initials = (session.fullName ?? session.email)
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <span className="hidden md:inline-block text-body-md text-on-surface-variant">
        สวัสดี, {session.fullName ?? 'ผู้ใช้'}
      </span>
      <div
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-secondary font-semibold text-label-md"
        aria-label={`ผู้ใช้: ${session.fullName ?? session.email}`}
      >
        {initials || 'U'}
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <MaterialIcon name="logout" size={16} />
          ออกจากระบบ
        </button>
      </form>
    </div>
  )
}
