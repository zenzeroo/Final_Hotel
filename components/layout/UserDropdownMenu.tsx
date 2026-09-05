'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { SessionUser } from '@/lib/supabase/getSession'

interface UserDropdownMenuProps {
  session: SessionUser
}

/**
 * Client island — avatar button that toggles a dropdown with two actions:
 *   - "ดูโปรไฟล์ของฉัน" → /account/profile
 *   - "ออกจากระบบ" → signOut() server action
 *
 * Used by <TopNavBar> ONLY when session.role === 'user' (staff keep
 the existing inline sign-out form per TopNavBar.tsx).
 *
 * Closes on:
 *   - click anywhere outside the menu
 *   - Escape key
 *
 * Follows the ScrollNavIsland pattern: minimal client island so the
 * rest of the nav stays a Server Component.
 */
export function UserDropdownMenu({ session }: UserDropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const initials = (session.fullName ?? session.email)
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="เมนูผู้ใช้"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-1 py-1 rounded-full hover:bg-surface-container-low transition-colors"
      >
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-secondary font-semibold text-label-md"
          aria-hidden
        >
          {initials || 'U'}
        </span>
        <span className="hidden md:inline text-body-md text-on-surface truncate max-w-[120px]">
          {session.fullName ?? 'ผู้ใช้'}
        </span>
        <MaterialIcon
          name={open ? 'expand_less' : 'expand_more'}
          size={20}
          className="text-on-surface-variant"
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="เมนูผู้ใช้"
          className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-level-1 border border-outline-variant py-1 z-50"
        >
          <div className="px-4 py-2 border-b border-outline-variant">
            <p className="font-label-md text-label-md text-on-surface truncate">
              {session.fullName ?? 'ผู้ใช้'}
            </p>
            <p className="font-caption text-caption text-on-surface-variant truncate">
              {session.email}
            </p>
          </div>

          {/* NOTE — intentionally NO onClick={() => setOpen(false)} on the
              Link. Calling setState before Next.js Link's internal
              router.push can unmount the <a> mid-navigation, causing
              the click to be silently dropped. The dropdown closes
              naturally because the page navigates away (parent
              component unmounts). */}
          <Link
            href="/account/profile"
            role="menuitem"
            className="flex items-center gap-3 px-4 py-3 font-body-md text-body-md text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <MaterialIcon name="person" size={20} className="text-on-surface-variant" />
            ดูโปรไฟล์ของฉัน
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center gap-3 px-4 py-3 font-body-md text-body-md text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <MaterialIcon name="logout" size={20} className="text-on-surface-variant" />
              ออกจากระบบ
            </button>
          </form>
        </div>
      )}
    </div>
  )
}