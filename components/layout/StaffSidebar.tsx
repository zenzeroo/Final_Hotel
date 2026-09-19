'use client'

import Link from 'next/link'
import { MaterialIcon } from '../ui/MaterialIcon'
import { signOut } from '@/app/actions/auth'
import { useT } from '@/lib/i18n/useT'
import { roleHomePath } from '@/lib/supabase/roles'

export type StaffRole = 'reception' | 'housekeeper' | 'manager' | 'admin'

interface StaffSidebarProps {
  role: StaffRole
  userName: string | null
  pathname: string
}

interface StaffSidebarNavProps {
  role: StaffRole
  userName: string | null
  pathname: string
  /** Optional callback fired when a nav item is clicked (used to close mobile overlay) */
  onNavigate?: () => void
}

interface NavItem {
  key: string
  href: string
  icon: string
  disabled?: boolean
}

const NAV_BY_ROLE: Record<StaffRole, NavItem[]> = {
  reception: [
    { key: 'dashboard', href: '/reception', icon: 'dashboard' },
    { key: 'bookings', href: '/reception/bookings', icon: 'bookmark' },
    { key: 'walkIn', href: '/reception/bookings/new', icon: 'person_add' },
    { key: 'checkInOut', href: '/reception/check-in-out', icon: 'swap_horiz' },
    { key: 'customers', href: '/reception/customers', icon: 'search' },
    { key: 'requests', href: '/reception/requests', icon: 'forum' },
    { key: 'rooms', href: '/reception/rooms', icon: 'hotel' },
    { key: 'maintenance', href: '/reception/maintenance', icon: 'build' },
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
    { key: 'maintenance', href: '/manager/maintenance', icon: 'build' },
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

const ROLE_LABEL_KEY: Record<StaffRole, string> = {
  reception: 'reception.sidebar.dashboard',
  housekeeper: 'housekeeper.title',
  manager: 'manager.title',
  admin: 'admin.title',
}

/**
 * Desktop sidebar — visible at md+ only. On mobile, the same content
 * is rendered inside `<StaffMobileHeader>`'s overlay via `<StaffSidebarNav>`.
 */
export function StaffSidebar({ role, userName, pathname }: StaffSidebarProps) {
  return (
    <aside className="hidden md:flex w-72 shrink-0 self-start sticky top-0 z-30 bg-primary text-secondary h-screen flex-col">
      <StaffSidebarNav role={role} userName={userName} pathname={pathname} />
    </aside>
  )
}

/**
 * Inner navigation content (used by both desktop `<StaffSidebar>` and
 * mobile `<StaffMobileHeader>` overlay). Exported so the mobile header
 * can render the same nav links inside its `<MobileOverlay>`.
 */
export function StaffSidebarNav({ role, userName, pathname, onNavigate }: StaffSidebarNavProps) {
  const t = useT()
  const navItems = NAV_BY_ROLE[role] ?? []

  return (
    <>
      {/* Brand */}
      <div className="px-6 py-6 border-b border-primary-container">
        <Link
          href={roleHomePath(role)}
          onClick={onNavigate}
          className="group inline-flex items-center gap-1 font-display text-2xl font-bold text-secondary hover:text-on-primary hover:translate-x-0.5 transition-all duration-150 ease-out rounded px-1 -mx-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          Zenzero Hotel
          <MaterialIcon
            name="arrow_forward"
            size={20}
            className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
          />
        </Link>
        <p className="text-caption text-secondary/70 mt-1 uppercase tracking-wider">
          {t(ROLE_LABEL_KEY[role])}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
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
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-secondary/40 cursor-not-allowed transition-colors duration-150 hover:bg-secondary/5"
                title="เร็วๆ นี้"
              >
                <MaterialIcon name={item.icon} size={20} />
                <span className="text-body-md">{navLabel(t, role, item.key)}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-secondary/40 transition-opacity duration-150 group-hover:opacity-70">
                  เร็วๆ นี้
                </span>
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative overflow-hidden flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-lg border-l-2 transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary [--icon-fill:1] ${
                isActive
                  ? 'bg-primary text-on-primary font-semibold border-secondary shadow-[-3px_0_8px_-1px_rgba(254,215,152,0.5)]'
                  : 'text-secondary/80 border-transparent hover:bg-primary-fixed hover:text-primary hover:translate-x-0.5 hover:border-l-secondary hover:shadow-[-2px_0_6px_-1px_rgba(254,215,152,0.3)]'
              }`}
            >
              <MaterialIcon name={item.icon} size={20} filled={isActive} />
              <span className="text-body-md">{navLabel(t, role, item.key)}</span>
              <MaterialIcon
                name="chevron_right"
                size={18}
                className={`ml-auto transition-all duration-150 ease-out ${
                  isActive
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'
                }`}
              />
              {/* Sheen sweep — pseudo-element travels left-to-right on hover.
                  pointer-events-none + aria-hidden so it's purely decorative. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-secondary/15 to-transparent -translate-x-full group-hover:translate-x-[200%] transition-transform duration-700 ease-out"
              />
            </Link>
          )
        })}
      </nav>

      {/* User + Profile + Logout */}
      <div className="px-3 py-4 border-t border-primary-container">
        <div className="px-3 py-2 mb-2">
          <p className="text-caption text-secondary/70 uppercase tracking-wider">{userName ?? 'ผู้ใช้งาน'}</p>
        </div>
        {/* Profile link — /[role]/profile. Inherits the same Tier 3 polish
            (slide + chevron + border-l accent) as the main nav items. */}
        <Link
          href={`/${role}/profile`}
          onClick={onNavigate}
          className="group flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-lg border-l-2 border-transparent text-secondary/80 hover:bg-primary-fixed hover:text-primary hover:translate-x-0.5 hover:border-l-secondary hover:shadow-[-2px_0_6px_-1px_rgba(254,215,152,0.3)] [--icon-fill:1] transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <MaterialIcon name="account_circle" size={20} />
          <span className="text-body-md">โปรไฟล์</span>
          <MaterialIcon
            name="chevron_right"
            size={18}
            className="ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
          />
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="group w-full flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-lg border-l-2 border-transparent text-secondary/80 hover:bg-primary-fixed hover:text-primary hover:translate-x-0.5 hover:border-l-error/50 transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <MaterialIcon name="logout" size={20} />
            <span className="text-body-md">{t('nav.logout')}</span>
            <MaterialIcon
              name="chevron_right"
              size={18}
              className="ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
            />
          </button>
        </form>
      </div>
    </>
  )
}

/** Map (role, navKey) → translation key. */
function navLabel(
  t: ReturnType<typeof useT>,
  role: StaffRole,
  key: string,
): string {
  const directKey = `${role}.sidebar.${key}`
  const direct = t(directKey)
  if (direct !== directKey) return direct
  const fallback = t(`${role}.${key}`)
  return fallback === `${role}.${key}` ? key : fallback
}