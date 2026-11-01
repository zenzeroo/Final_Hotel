'use client'

/**
 * TopNavBar nav link — client island for `usePathname()` so the active
 * item can render underlined in the ink colour.
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
      className={`px-3 py-2 text-body-md whitespace-nowrap underline-offset-8 decoration-2 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
        isActive
          ? 'text-primary font-semibold underline'
          : 'text-on-surface hover:text-primary hover:underline'
      }`}
    >
      {children}
    </Link>
  )
}