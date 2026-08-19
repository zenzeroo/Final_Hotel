'use client'

import { useEffect, useState, type ReactNode } from 'react'

interface ScrollNavIslandProps {
  children: ReactNode
}

/**
 * Wraps the navbar with a scroll-aware class toggle.
 * (Minimal client island — keeps the rest of the nav as Server Components.)
 */
export function ScrollNavIsland({ children }: ScrollNavIslandProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={
        scrolled
          ? 'shadow-(--shadow-ambient)'
          : ''
      }
    >
      {children}
    </div>
  )
}
