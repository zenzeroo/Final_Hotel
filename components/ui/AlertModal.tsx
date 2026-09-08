'use client'

import type { ReactNode } from 'react'
import { CenterModal } from './CenterModal'

/**
 * Phase 27.A — Replaces browser-native `alert()`. Centered modal
 * with title + body + single OK button. Body supports multi-line
 * strings (split by \n into <p> elements) or arbitrary ReactNode
 * for richer formatting.
 *
 * Usage in a client component:
 *   const [alert, setAlert] = useState<{title?: string; body: string} | null>(null)
 *   ...
 *   setAlert({ body: 'บันทึกสำเร็จ' })
 *   ...
 *   {alert && <AlertModal open onClose={() => setAlert(null)} body={alert.body} title={alert.title} />}
 */
export interface AlertModalProps {
  open: boolean
  onClose: () => void
  /** Title text (short, bold) — optional */
  title?: string
  /** Body — string split on \n into paragraphs, or ReactNode */
  body: string | ReactNode
  /** OK button label */
  okLabel?: string
}

export function AlertModal({
  open,
  onClose,
  title,
  body,
  okLabel = 'ตกลง',
}: AlertModalProps) {
  const titleId = 'alert-modal-title'
  const showTitle = !!title

  return (
    <CenterModal open={open} onClose={onClose} ariaLabelledBy={showTitle ? titleId : undefined}>
      <div className="flex flex-col gap-4">
        {showTitle && (
          <h2
            id={titleId}
            className="font-display text-xl font-bold text-primary text-center"
          >
            {title}
          </h2>
        )}
        <div className="text-body-md text-on-surface">
          {typeof body === 'string'
            ? body.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))
            : body}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 inline-flex items-center justify-center px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
        >
          {okLabel}
        </button>
      </div>
    </CenterModal>
  )
}
