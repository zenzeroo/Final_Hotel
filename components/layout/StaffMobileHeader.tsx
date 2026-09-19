'use client'

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { MobileOverlay } from '../ui/MobileOverlay'
import { StaffSidebarNav, type StaffRole } from './StaffSidebar'

interface StaffMobileHeaderProps {
  role: StaffRole
  userName: string | null
  /** R2 object key for the current user's avatar — drives the profile link icon. */
  avatarKey?: string | null
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
export function StaffMobileHeader({ role, userName, avatarKey }: StaffMobileHeaderProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 bg-primary text-secondary shadow-(--shadow-level-1)">
        <div className="flex items-center gap-3 h-14 px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="เปิดเมนู"
            className="inline-flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-primary-fixed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <MaterialIcon name="menu" size={24} />
          </button>
          <span className="font-display text-lg font-bold tracking-tight">
            Zenzero Hotel
          </span>
          {userName && (
            <span className="ml-auto text-caption text-secondary/70 uppercase tracking-wider truncate max-w-[40%]">
              {userName}
            </span>
          )}
        </div>
      </header>

      <MobileOverlay
        open={open}
        onClose={() => setOpen(false)}
        title="เมนู"
        panelClassName="bg-primary text-secondary"
      >
        <div className="bg-primary text-secondary h-full">
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