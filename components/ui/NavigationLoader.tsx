'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/i18n/useT'

/** Hide anyway after this long so a failed navigation can't trap the user. */
const SAFETY_TIMEOUT_MS = 15_000

/**
 * Full-screen loader shown while navigating to a *different pathname*.
 * Tab / filter changes (same pathname, new search params) never trigger it.
 *
 * Listens for link clicks on `window` in the bubble phase: a leave guard
 * (BookingHoldGuard, LeaveGuardProvider) calls `stopPropagation()` in the
 * document capture phase, so a blocked navigation never reaches us.
 * `defaultPrevented` is NOT checked — next/link always sets it. Clicks on a
 * button/input nested inside a link (card actions) are ignored. The overlay fades
 * in after a short delay (`animate-loader-in`) so fast navigations don't
 * flash it. Programmatic `router.push` is not intercepted.
 */
export function NavigationLoader() {
  const t = useT()
  const pathname = usePathname()
  // Pathname the pending navigation started from; null = idle.
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const [prevPathname, setPrevPathname] = useState(pathname)
  // Last rendered pathname, read by the popstate handler.
  const lastPathRef = useRef(pathname)
  useEffect(() => {
    lastPathRef.current = pathname
  }, [pathname])

  // Navigation finished → reset during render (no setState-in-effect).
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setPendingFrom(null)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const control = (e.target as Element).closest('button, input, select, textarea, label, [role="button"]')
      if (control && anchor.contains(control)) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname.startsWith('/api/')) return
      if (url.pathname === window.location.pathname) return
      setPendingFrom(window.location.pathname)
    }

    function onPopState() {
      if (window.location.pathname !== lastPathRef.current) setPendingFrom(lastPathRef.current)
    }

    window.addEventListener('click', onClick)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  useEffect(() => {
    if (pendingFrom === null) return
    const id = window.setTimeout(() => setPendingFrom(null), SAFETY_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [pendingFrom])

  if (pendingFrom === null) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-background animate-loader-in"
    >
      <span className="font-display text-3xl font-bold text-primary tracking-tight">Zenzero Hotel</span>
      <span
        aria-hidden="true"
        className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"
      />
      <span className="text-sm text-on-surface-variant">{t('ui.loading.label')}</span>
    </div>
  )
}
