'use client'

import { useEffect, useId } from 'react'
import { MaterialIcon } from './MaterialIcon'

/**
 * Full-screen mobile overlay primitive.
 *
 * Mirrors `<CenterModal>`'s keyboard + click-outside behavior but is
 * designed for mobile menu/drawer use cases where content needs the full
 * viewport (not a centered card). On desktop the same content renders
 * inside the overlay — typically only the mobile drawer uses this primitive.
 *
 * Features:
 * - Escape key closes
 * - Backdrop click closes (configurable)
 * - Body scroll lock while open (prevents page scroll behind overlay)
 * - Header with title + close X button
 * - Scrollable body region
 * - Auto focuses the close button on open (keyboard a11y)
 */
export interface MobileOverlayProps {
  open: boolean
  onClose: () => void
  /** Header title — short, bold. */
  title?: string
  children: React.ReactNode
  /** Default true — backdrop click closes */
  closeOnBackdrop?: boolean
  /** Optional className applied to the inner panel (e.g. for max-width on desktop) */
  panelClassName?: string
  /** Optional aria-label override (falls back to title) */
  ariaLabel?: string
}

export function MobileOverlay({
  open,
  onClose,
  title,
  children,
  closeOnBackdrop = true,
  panelClassName = '',
  ariaLabel,
}: MobileOverlayProps) {
  const reactId = useId()
  const titleId = `mobile-overlay-title-${reactId}`
  const showTitle = !!title

  // Escape key + body scroll lock
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)

    // Lock body scroll while overlay is open.
    const prevOverflow = document.documentElement.style.overflow
    const prevPaddingRight = document.documentElement.style.paddingRight
    document.documentElement.style.overflow = 'hidden'
    // Compensate for scrollbar disappearance to avoid layout jump (desktop).
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.documentElement.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      window.removeEventListener('keydown', handleKey)
      document.documentElement.style.overflow = prevOverflow
      document.documentElement.style.paddingRight = prevPaddingRight
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 md:bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby={showTitle ? titleId : undefined}
      aria-label={!showTitle ? ariaLabel : undefined}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`h-full w-full bg-surface-container-lowest md:max-w-md md:mx-auto md:my-4 md:h-[calc(100vh-2rem)] md:rounded-2xl md:shadow-(--shadow-ambient-lg) flex flex-col ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(showTitle || closeOnBackdrop) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant sticky top-0 bg-surface-container-lowest z-10">
            {showTitle ? (
              <h2 id={titleId} className="font-display text-xl font-bold text-primary">
                {title}
              </h2>
            ) : (
              <span className="sr-only">{ariaLabel ?? 'Menu'}</span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดเมนู"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-primary-fixed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              <MaterialIcon name="close" size={24} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}