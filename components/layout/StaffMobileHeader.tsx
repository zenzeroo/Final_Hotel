'use client'

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { MobileOverlay } from '../ui/MobileOverlay'
import { StaffSidebarNav, showsNotificationBell, type StaffRole } from './StaffSidebar'
import { useT } from '@/lib/i18n/useT'
import { NotificationBell } from '../notifications/NotificationBell'

interface StaffMobileHeaderProps {
  role: StaffRole
  userName: string | null
  /** R2 object key for the current user's avatar — drives the profile link icon. */
  avatarKey?: string | null
  userId: string
}

/**
 * Mobile-only header for staff portals.
 *
 * Replaces the always-on desktop sidebar on viewports < md with a sticky
 * top bar containing a hamburger trigger. Tapping the hamburger opens a
 * full-screen `<MobileOverlay>` containing the same `<StaffSidebarNav>`
 * content as the desktop sidebar — single source of truth for nav items.
 *
 * Hidden on md+ (the desktop `<StaffSidebar>` takes over).
 */
export function StaffMobileHeader({ role, userName, avatarKey, userId }: StaffMobileHeaderProps) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 bg-primary text-on-primary">
        <div className="flex items-center gap-3 h-14 px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('staff.openMenu')}
            className="inline-flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-on-primary/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"
          >
            <MaterialIcon name="menu" size={24} />
          </button>
          <span className="font-wordmark text-lg font-bold text-secondary-container">
            Zenzero Hotel
          </span>
          {userName && (
            <span className="ml-auto text-[14px] text-on-primary/70 truncate max-w-[40%]">
              {userName}
            </span>
          )}
          {showsNotificationBell(role) && (
            <div className={userName ? '' : 'ml-auto'}>
              <NotificationBell userId={userId} tone="dark" />
            </div>
          )}
        </div>
      </header>

      <MobileOverlay
        open={open}
        onClose={() => setOpen(false)}
        title={t('staff.menu')}
        panelClassName="bg-primary text-on-primary"
      >
        <div className="bg-primary text-on-primary h-full">
          {/* StaffSidebarNav already styled for primary background. We swap the
              body background via the panelClassName above; the nav itself uses
              its own bg-primary tokens. The wrapping div ensures the scroll region
              inherits the right background. */}
          <StaffSidebarNav
            role={role}
            userName={userName}
            avatarKey={avatarKey}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </MobileOverlay>
    </>
  )
}