'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MaterialIcon } from '../ui/MaterialIcon'
import { MobileOverlay } from '../ui/MobileOverlay'
import { LanguageToggle } from './LanguageToggle'
import { signOut } from '@/app/actions/auth'
import type { Locale } from '@/lib/i18n/config'

interface MobileNavMenuProps {
  isAuthed: boolean
  role: 'user' | 'reception' | 'housekeeper' | 'manager' | 'admin'
  labels: {
    home: string
    rooms: string
    bookings: string
    about: string
    login: string
    logout: string
    greeting: string
    notification: string
    menu: string
    menuAriaLabel: string
  }
  locale: Locale
}

/**
 * Mobile-only hamburger menu for public-facing TopNavBar.
 *
 * Renders a hamburger button on viewports < md. Tap → opens a full-screen
 * `<MobileOverlay>` containing the same nav links, auth controls, and
 * language toggle that the desktop nav exposes. Closing happens via
 * backdrop click, X button, or Escape key.
 */
export function MobileNavMenu({ isAuthed, role, labels, locale }: MobileNavMenuProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.menuAriaLabel}
        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-primary-fixed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <MaterialIcon name="menu" size={24} />
      </button>

      <MobileOverlay open={open} onClose={close} title={labels.menu}>
        <nav className="flex flex-col gap-1 p-4">
          <MobileNavItem href="/" icon="home" label={labels.home} onNavigate={close} />
          <MobileNavItem href="/rooms" icon="hotel" label={labels.rooms} onNavigate={close} />
          <MobileNavItem href="/bookings" icon="bookmark" label={labels.bookings} onNavigate={close} />
          <MobileNavItem href="/about" icon="info" label={labels.about} onNavigate={close} />

          {isAuthed && (
            <>
              <div className="my-2 border-t border-outline-variant" />
              <MobileNavItem
                href="/account/profile"
                icon="account_circle"
                label={labels.greeting}
                onNavigate={close}
              />
              {role !== 'user' && (
                <MobileNavItem
                  href={`/${role}`}
                  icon="dashboard"
                  label={role}
                  onNavigate={close}
                />
              )}
            </>
          )}
        </nav>

        <div className="px-4 pb-4 flex items-center gap-3 border-t border-outline-variant pt-4">
          <LanguageToggle currentLocale={locale} />
          {isAuthed ? (
            <form action={signOut} className="ml-auto">
              <button
                type="submit"
                title={labels.logout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant text-label-md text-on-surface hover:bg-primary-fixed hover:text-primary transition-colors min-w-[140px] justify-center whitespace-nowrap"
              >
                <MaterialIcon name="logout" size={16} className="flex-shrink-0" />
                <span className="truncate">{labels.logout}</span>
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              onClick={close}
              title={labels.login}
              className="ml-auto inline-flex items-center justify-center h-10 px-5 rounded-full bg-primary text-on-primary font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors min-w-[140px] whitespace-nowrap"
            >
              <span className="truncate">{labels.login}</span>
            </Link>
          )}
        </div>
      </MobileOverlay>
    </>
  )
}

function MobileNavItem({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string
  icon: string
  label: string
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={label}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-body-lg text-on-surface hover:bg-primary-fixed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary min-w-0"
    >
      <MaterialIcon name={icon} size={20} className="flex-shrink-0" />
      <span className="min-w-0 truncate flex-1">{label}</span>
    </Link>
  )
}