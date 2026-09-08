'use client'

import { useEffect, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

export function CheckEmailModal() {
  const [open, setOpen] = useState(true)
  const t = useT()
  const titleId = 'check-email-modal-title'

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-primary">
            <MaterialIcon name="mark_email_read" size={32} />
          </div>

          <h2
            id={titleId}
            className="font-display text-2xl font-bold text-primary"
          >
            {t('auth.checkEmailModalTitle')}
          </h2>

          <p className="text-body-md text-on-surface-variant">
            {t('auth.checkEmailModalBody')}
          </p>

          <p className="text-caption text-on-surface-variant/80">
            {t('auth.checkEmailModalSpam')}
          </p>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full mt-2 inline-flex items-center justify-center px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            {t('auth.checkEmailModalOk')}
          </button>
        </div>
      </div>
    </div>
  )
}
