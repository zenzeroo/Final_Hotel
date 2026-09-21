'use client'

/**
 * TopNavBar nav link — client island for `usePathname()` so the active
 * item can render with the dark `bg-primary text-on-primary` style
 * (matches LanguageToggle's selected state).
 *
 * Replaces the inline `NavLink` helper that used to live in TopNavBar.tsx
 * — that version was a Server Component and couldn't read the URL.
 */
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface NavLinkProps {
  href: string
  children: ReactNode
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname()
  const isActive =
    pathname === href || (href !== '/' && pathname.startsWith(href + '/'))

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      title={typeof children === 'string' ? children : undefined}
      className={`px-3 py-2 rounded-md text-body-md whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
        isActive
          ? 'bg-primary text-on-primary font-semibold'
          : 'text-on-surface hover:bg-primary-fixed hover:text-primary'
      }`}
    >
      {children}
    </Link>
  )
}