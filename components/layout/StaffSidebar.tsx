'use client'

import Link from 'next/link'
import { MaterialIcon } from '../ui/MaterialIcon'
import { signOut } from '@/app/actions/auth'
import { useT } from '@/lib/i18n/useT'

interface StaffSidebarProps {
  role: 'reception' | 'housekeeper' | 'manager' | 'admin'
  userName: string | null
  pathname: string
}

interface NavItem {
  key: string
  href: string
  icon: string
  disabled?: boolean
}

const NAV_BY_ROLE: Record<StaffSidebarProps['role'], NavItem[]> = {
  reception: [
    { key: 'dashboard', href: '/reception', icon: 'dashboard' },
    { key: 'bookings', href: '/reception/bookings', icon: 'bookmark' },
    { key: 'walkIn', href: '/reception/bookings/new', icon: 'person_add' },
    { key: 'checkInOut', href: '/reception/check-in-out', icon: 'swap_horiz' },
    { key: 'customers', href: '/reception/customers', icon: 'search' },
    { key: 'requests', href: '/reception/requests', icon: 'forum' },
    { key: 'rooms', href: '/reception/rooms', icon: 'hotel' },
    { key: 'history', href: '/reception/history', icon: 'history' },
  ],
  housekeeper: [
    { key: 'dashboard', href: '/housekeeper', icon: 'dashboard' },
    { key: 'rooms', href: '/housekeeper/rooms', icon: 'hotel' },
    { key: 'tasks', href: '/housekeeper/tasks', icon: 'task_alt' },
    { key: 'history', href: '/housekeeper/history', icon: 'history' },
    { key: 'maintenance', href: '/housekeeper/maintenance', icon: 'build' },
  ],
  manager: [
    { key: 'dashboard', href: '/manager', icon: 'dashboard' },
    { key: 'reports', href: '/manager/reports', icon: 'analytics' },
    { key: 'settings', href: '/manager/settings', icon: 'settings' },
    { key: 'rates', href: '/manager/rates', icon: 'bed' },
    { key: 'bookings', href: '/manager/bookings', icon: 'calendar_month' },
    { key: 'staff', href: '/manager/staff', icon: 'badge' },
    { key: 'housekeeping', href: '/manager/housekeeping', icon: 'cleaning_services' },
    { key: 'reviews', href: '/manager/reviews', icon: 'reviews' },
    { key: 'promotions', href: '/manager/promotions', icon: 'sell' },
  ],
  admin: [
    { key: 'dashboard', href: '/admin', icon: 'dashboard' },
    { key: 'promotions', href: '/admin/promotions', icon: 'sell' },
    { key: 'staff', href: '/admin/staff', icon: 'badge' },
    { key: 'rates', href: '/admin/rates', icon: 'bed' },
    { key: 'settings', href: '/admin/settings', icon: 'settings' },
  ],
}

const ROLE_LABEL_KEY: Record<StaffSidebarProps['role'], string> = {
  reception: 'reception.sidebar.dashboard', // top-level role label is per-page title elsewhere
  housekeeper: 'housekeeper.title',
  manager: 'manager.title',
  admin: 'admin.title',
}

export function StaffSidebar({ role, userName, pathname }: StaffSidebarProps) {
  const t = useT()
  const navItems = NAV_BY_ROLE[role] ?? []

  return (
    <aside className="w-72 shrink-0 bg-primary text-secondary min-h-screen flex flex-col">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-primary-container">
        <Link href="/" className="font-display text-2xl font-bold text-secondary">
          Zenzero Hotel
        </Link>
        <p className="text-caption text-secondary/70 mt-1 uppercase tracking-wider">
          {t(ROLE_LABEL_KEY[role])}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = !item.disabled && (
            pathname === item.href ||
            (item.href !== `/${role}` && pathname.startsWith(item.href + '/'))
          )
          if (item.disabled) {
            return (
              <div
                key={item.href}
                aria-disabled="true"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-secondary/40 cursor-not-allowed"
                title="เร็วๆ นี้"
              >
                <MaterialIcon name={item.icon} size={20} />
                <span className="text-body-md">{navLabel(t, role, item.key)}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-secondary/40">
                  เร็วๆ นี้
                </span>
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-container text-secondary font-semibold'
                  : 'text-secondary/80 hover:bg-primary-container/50 hover:text-secondary'
              }`}
            >
              <MaterialIcon name={item.icon} size={20} filled={isActive} />
              <span className="text-body-md">{navLabel(t, role, item.key)}</span>
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-primary-container">
        <div className="px-3 py-2 mb-2">
          <p className="text-caption text-secondary/70 uppercase tracking-wider">{userName ?? 'ผู้ใช้งาน'}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-secondary/80 hover:bg-primary-container/50 hover:text-secondary transition-colors"
          >
            <MaterialIcon name="logout" size={20} />
            <span className="text-body-md">{t('nav.logout')}</span>
          </button>
        </form>
      </div>
    </aside>
  )
}

/** Map (role, navKey) → translation key. */
function navLabel(
  t: ReturnType<typeof useT>,
  role: StaffSidebarProps['role'],
  key: string,
): string {
  // Most keys exist directly under `<role>.sidebar.<key>`. A few
  // (e.g. 'dashboard') are at `<role>.title` for the role's top page.
  const directKey = `${role}.sidebar.${key}`
  const direct = t(directKey)
  if (direct !== directKey) return direct
  // Fall back to the role's <key> (which is what `dashboard` uses).
  const fallback = t(`${role}.${key}`)
  return fallback === `${role}.${key}` ? key : fallback
}
