'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AvatarBadge } from '@/components/account/AvatarBadge'
import { TruncatedText } from '@/components/ui/TruncatedText'
import { signOut } from '@/app/actions/auth'
import { useLocale, useT } from '@/lib/i18n/useT'
import { LanguageToggle } from './LanguageToggle'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { roleHomePath } from '@/lib/supabase/roles'

export type StaffRole = 'reception' | 'housekeeper' | 'manager' | 'admin'

/** Roles that get the TH | EN switch in the sidebar (and the mobile menu). */
function showsLanguageToggle(role: StaffRole): boolean {
  return role !== 'housekeeper'
}

/**
 * Only housekeepers get the in-app bell (task assignments). Reception, manager
 * and admin have none; the manager dashboard's "needs action" covers theirs.
 */
export function showsNotificationBell(role: StaffRole): boolean {
  return role === 'housekeeper'
}

interface StaffSidebarProps {
  role: StaffRole
  userName: string | null
  /** R2 object key for the current user's avatar — drives the profile link icon. */
  avatarKey?: string | null
}

interface StaffSidebarNavProps {
  role: StaffRole
  userName: string | null
  /** R2 object key for the current user's avatar — drives the profile link icon. */
  avatarKey?: string | null
  /** Optional callback fired when a nav item is clicked (used to close mobile overlay) */
  onNavigate?: () => void
}

interface NavItem {
  key: string
  href: string
  icon: string
  disabled?: boolean
}

/** A titled section of the sidebar; `key` → `nav.groups.<key>`. */
interface NavGroup {
  key: string
  items: NavItem[]
}

const NAV_BY_ROLE: Record<StaffRole, NavGroup[]> = {
  reception: [
    { key: 'overview', items: [{ key: 'dashboard', href: '/reception', icon: 'dashboard' }] },
    {
      key: 'bookings',
      items: [
        { key: 'bookings', href: '/reception/bookings', icon: 'bookmark' },
        { key: 'walkIn', href: '/reception/bookings/new', icon: 'person_add' },
        { key: 'checkInOut', href: '/reception/check-in-out', icon: 'swap_horiz' },
        { key: 'history', href: '/reception/history', icon: 'history' },
      ],
    },
    {
      key: 'customers',
      items: [
        { key: 'customers', href: '/reception/customers', icon: 'search' },
        { key: 'requests', href: '/reception/requests', icon: 'forum' },
      ],
    },
    {
      key: 'rooms',
      items: [
        { key: 'rooms', href: '/reception/rooms', icon: 'hotel' },
        { key: 'maintenance', href: '/reception/maintenance', icon: 'build' },
      ],
    },
  ],
  housekeeper: [
    {
      key: 'myWork',
      items: [
        { key: 'dashboard', href: '/housekeeper', icon: 'dashboard' },
        { key: 'tasks', href: '/housekeeper/tasks', icon: 'task_alt' },
        { key: 'history', href: '/housekeeper/history', icon: 'history' },
      ],
    },
    {
      key: 'rooms',
      items: [
        { key: 'rooms', href: '/housekeeper/rooms', icon: 'hotel' },
        { key: 'maintenance', href: '/housekeeper/maintenance', icon: 'build' },
      ],
    },
  ],
  manager: [
    {
      key: 'overview',
      items: [
        { key: 'dashboard', href: '/manager', icon: 'dashboard' },
        { key: 'reports', href: '/manager/reports', icon: 'analytics' },
      ],
    },
    {
      key: 'salesBookings',
      items: [
        { key: 'bookings', href: '/manager/bookings', icon: 'calendar_month' },
        { key: 'rooms', href: '/manager/rooms', icon: 'bed' },
        { key: 'promotions', href: '/manager/promotions', icon: 'sell' },
        { key: 'reviews', href: '/manager/reviews', icon: 'reviews' },
      ],
    },
    {
      key: 'operations',
      items: [
        { key: 'housekeeping', href: '/manager/housekeeping', icon: 'cleaning_services' },
        { key: 'maintenance', href: '/manager/maintenance', icon: 'build' },
        { key: 'staff', href: '/manager/staff', icon: 'badge' },
      ],
    },
  ],
  admin: [
    { key: 'overview', items: [{ key: 'dashboard', href: '/admin', icon: 'dashboard' }] },
    {
      key: 'users',
      items: [
        // Phase 36 — customer management (admin only).
        { key: 'customers', href: '/admin/customers', icon: 'group' },
        { key: 'staff', href: '/admin/staff', icon: 'badge' },
      ],
    },
    {
      key: 'sales',
      items: [
        { key: 'rates', href: '/admin/rates', icon: 'bed' },
        { key: 'promotions', href: '/admin/promotions', icon: 'sell' },
      ],
    },
    // Phase 43 — homepage hero carousel admin (curated slides).
    // Phase 62 — legal PDFs (privacy / terms) shown on the site + consent.
    {
      key: 'website',
      items: [
        { key: 'heroCarousel', href: '/admin/hero-carousel', icon: 'image' },
        { key: 'legal', href: '/admin/legal', icon: 'gavel' },
      ],
    },
    { key: 'system', items: [{ key: 'settings', href: '/admin/settings', icon: 'settings' }] },
  ],
}

/**
 * Desktop sidebar — visible at md+ only. On mobile, the same content
 * is rendered inside `<StaffMobileHeader>`'s overlay via `<StaffSidebarNav>`.
 */
export function StaffSidebar({ role, userName, avatarKey, userId }: StaffSidebarProps & { userId: string }) {
  return (
    <aside className="hidden md:flex w-72 shrink-0 self-start sticky top-0 z-30 bg-primary text-on-primary h-screen flex-col">
      <StaffSidebarNav
        role={role}
        userName={userName}
        avatarKey={avatarKey}
        headerAction={
          showsNotificationBell(role) ? (
            <NotificationBell userId={userId} align="left" tone="dark" />
          ) : undefined
        }
      />
    </aside>
  )
}

/**
 * Inner navigation content (used by both desktop `<StaffSidebar>` and
 * mobile `<StaffMobileHeader>` overlay). Exported so the mobile header
 * can render the same nav links inside its `<MobileOverlay>`.
 */
export function StaffSidebarNav({
  role,
  userName,
  avatarKey,
  onNavigate,
  headerAction,
}: StaffSidebarNavProps & { headerAction?: React.ReactNode }) {
  const pathname = usePathname()
  const t = useT()
  const locale = useLocale()
  const navGroups = NAV_BY_ROLE[role] ?? []
  const isItemActive = (item: NavItem) =>
    !item.disabled &&
    (pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href + '/')))
  const { collapsed, toggle, expand } = useCollapsedGroups(role)

  // The group holding the current page always opens, so the highlighted
  // item is never hidden behind a collapsed heading.
  const activeGroupKey = navGroups.find((g) => g.items.some(isItemActive))?.key
  useEffect(() => {
    if (activeGroupKey) expand(activeGroupKey)
  }, [activeGroupKey, expand])

  return (
    <>
      {/* Brand + who this workspace is for */}
      <div className={`relative px-6 pt-6 pb-5 border-b border-on-primary/10 ${headerAction ? 'pr-16' : ''}`}>
        {headerAction && <div className="absolute right-4 top-5">{headerAction}</div>}
        <Link
          href={roleHomePath(role)}
          onClick={onNavigate}
          className="font-wordmark text-2xl font-bold text-secondary-container hover:text-on-primary transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"
        >
          Zenzero Hotel
        </Link>
        <p className="mt-1 text-[14px] text-on-primary/70 truncate" title={t(`staff.roleName.${role}`)}>
          {t(`staff.roleName.${role}`)}
        </p>
        {showsLanguageToggle(role) && (
          <div className="mt-3">
            <LanguageToggle currentLocale={locale} tone="dark" />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col overflow-y-auto">
        {navGroups.map((group) => {
          const open = !collapsed.includes(group.key)
          const label = t(`nav.groups.${group.key}`)
          const panelId = `nav-group-${role}-${group.key}`
          return (
            <div key={group.key} className="flex flex-col pt-4 first:pt-0">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex items-center justify-between min-h-8 px-3 rounded-md text-[13px] font-medium text-on-primary/60 hover:text-on-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"
              >
                <span className="truncate">{label}</span>
                <MaterialIcon
                  name="expand_less"
                  size={18}
                  className={`flex-shrink-0 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
                />
              </button>
              {/* grid-rows 1fr ↔ 0fr animates the height without measuring it.
                  `inert` keeps hidden links out of the tab order. */}
              <div
                id={panelId}
                role="group"
                aria-label={label}
                inert={!open}
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="min-h-0 overflow-hidden -mx-1 px-1">
                  <div className="flex flex-col gap-0.5 pt-1">
                    {group.items.map((item) => {
                      const isActive = isItemActive(item)
                      if (item.disabled) {
                        return (
                          <div
                            key={item.href}
                            aria-disabled="true"
                            className="flex items-center gap-3 min-h-11 px-3 rounded-lg text-on-primary/40 cursor-not-allowed"
                            title={t('staff.comingSoon')}
                          >
                            <MaterialIcon name={item.icon} size={20} className="flex-shrink-0" />
                            <TruncatedText text={navLabel(t, role, item.key)} className="text-body-md" />
                            <span className="ml-auto flex-shrink-0 text-[12px]">{t('staff.comingSoon')}</span>
                          </div>
                        )
                      }
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={isActive ? 'page' : undefined}
                          className={`relative flex items-center gap-3 min-h-11 px-3 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container ${
                            isActive
                              ? 'bg-on-primary/10 text-on-primary font-semibold before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1 before:rounded-full before:bg-secondary-container'
                              : 'text-on-primary/75 hover:bg-on-primary/5 hover:text-on-primary'
                          }`}
                        >
                          <MaterialIcon
                            name={item.icon}
                            size={20}
                            filled={isActive}
                            className={`flex-shrink-0 ${isActive ? 'text-secondary-container' : ''}`}
                          />
                          <TruncatedText text={navLabel(t, role, item.key)} className="text-body-md" />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Who is signed in → profile; then sign out. */}
      <div className="px-3 py-4 border-t border-on-primary/10 flex flex-col gap-0.5">
        <Link
          href={`/${role}/profile`}
          onClick={onNavigate}
          aria-current={pathname === `/${role}/profile` ? 'page' : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container ${
            pathname === `/${role}/profile` ? 'bg-on-primary/10' : 'hover:bg-on-primary/5'
          }`}
        >
          <AvatarBadge
            avatarKey={avatarKey ?? null}
            fullName={userName ?? t('staff.userFallback')}
            size={32}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-body-md font-semibold text-on-primary truncate" title={userName ?? t('staff.userFallback')}>
              {userName ?? t('staff.userFallback')}
            </span>
            <span className="block text-[13px] text-on-primary/60 truncate">{t('staff.profile')}</span>
          </span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 min-h-11 px-3 rounded-lg text-on-primary/75 hover:bg-on-primary/5 hover:text-on-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"
          >
            <MaterialIcon name="logout" size={20} className="flex-shrink-0" />
            <TruncatedText text={t('nav.logout')} className="text-body-md" />
          </button>
        </form>
      </div>
    </>
  )
}

// ── Collapsed-group store ────────────────────────────────────────────────
// localStorage-backed, read through useSyncExternalStore. `memory` mirrors
// every write so toggling still works when storage is blocked (private
// mode); the desktop sidebar and the mobile overlay share one state.
const collapsedListeners = new Set<() => void>()
const collapsedMemory = new Map<string, string>()

function readCollapsedRaw(storageKey: string): string {
  const mem = collapsedMemory.get(storageKey)
  if (mem !== undefined) return mem
  try {
    return localStorage.getItem(storageKey) ?? '[]'
  } catch {
    return '[]'
  }
}

function writeCollapsedRaw(storageKey: string, raw: string) {
  collapsedMemory.set(storageKey, raw)
  try {
    localStorage.setItem(storageKey, raw)
  } catch {
    // not persisted — the in-memory copy keeps this session working
  }
  collapsedListeners.forEach((l) => l())
}

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener)
  return () => {
    collapsedListeners.delete(listener)
  }
}

function parseCollapsed(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return [] // corrupt value — show everything expanded
  }
}

/**
 * Which sidebar groups are collapsed, remembered per role. The server render
 * (and first hydration pass) is all-expanded; the saved state applies right
 * after hydration.
 */
function useCollapsedGroups(role: StaffRole) {
  const storageKey = `zenzero.sidebar.collapsed.${role}`
  const raw = useSyncExternalStore(
    subscribeCollapsed,
    () => readCollapsedRaw(storageKey),
    () => '[]',
  )
  const collapsed = useMemo(() => parseCollapsed(raw), [raw])

  const update = useCallback(
    (fn: (prev: string[]) => string[]) => {
      const prev = parseCollapsed(readCollapsedRaw(storageKey))
      const next = fn(prev)
      if (next !== prev) writeCollapsedRaw(storageKey, JSON.stringify(next))
    },
    [storageKey],
  )

  const toggle = useCallback(
    (key: string) => update((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])),
    [update],
  )
  const expand = useCallback(
    (key: string) => update((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev)),
    [update],
  )

  return { collapsed, toggle, expand }
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