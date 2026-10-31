'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * A table row that opens `href` when clicked anywhere. Keep a real <Link>
 * inside the row (e.g. on the code) for keyboard users and "open in new tab";
 * same pattern as `ManagerBookingRow`.
 */
export function LinkRow({ href, className = '', children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter()
  return (
    <tr
      onClick={(e) => {
        // A link inside the row navigates on its own (and honours ctrl/cmd-click).
        if ((e.target as HTMLElement).closest('a')) return
        router.push(href)
      }}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </tr>
  )
}
