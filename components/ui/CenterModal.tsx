'use client'

import { useEffect } from 'react'

/**
 * Phase 27.A — Modal primitive. Backdrop + Escape key + role/aria
 * + click-outside-to-close + content click shield. Used by
 * AlertModal, ConfirmModal, CheckEmailModal, PaymentSuccessModal.
 *
 * Before this primitive existed, every dialog duplicated the
 * backdrop markup (6 hand-rolled dialogs in the codebase as of
 * Phase 26 — see CLAUDE.md "Known gaps"). New dialogs should
 * extend this primitive instead of repeating the wrapper.
 */
export interface CenterModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** id of an element inside children that titles the dialog (for screen readers) */
  ariaLabelledBy?: string
  /** Default true — backdrop click closes the dialog */
  closeOnBackdrop?: boolean
  /** Width class for the inner card — default 'max-w-md' */
  maxWidthClass?: string
}

export function CenterModal({
  open,
  onClose,
  children,
  ariaLabelledBy,
  closeOnBackdrop = true,
  maxWidthClass = 'max-w-md',
}: CenterModalProps) {
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`w-full ${maxWidthClass} bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) p-6 md:p-8`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
