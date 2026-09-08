'use client'

import type { ReactNode } from 'react'
import { CenterModal } from './CenterModal'

/**
 * Phase 27.A — Replaces browser-native `confirm()`. Centered modal
 * with title + body + Cancel/OK buttons. Cancel button receives
 * onCancel, OK button receives onConfirm.
 *
 * Usage in a client component (Promise-based):
 *   const [confirm, setConfirm] = useState<{
 *     title?: string; body: string;
 *     onResolve: (v: boolean) => void
 *   } | null>(null)
 *
 *   const ok = await new Promise<boolean>((resolve) => {
 *     setConfirm({ body: 'ลบโปรโมชั่น?', onResolve: resolve })
 *   })
 *   if (!ok) return
 *
 *   ...
 *   {confirm && (
 *     <ConfirmModal
 *       open
 *       title={confirm.title}
 *       body={confirm.body}
 *       onCancel={() => { confirm.onResolve(false); setConfirm(null) }}
 *       onConfirm={() => { confirm.onResolve(true); setConfirm(null) }}
 *     />
 *   )}
 */
export interface ConfirmModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  /** Title text (short, bold) — optional */
  title?: string
  /** Body — string split on \n into paragraphs, or ReactNode */
  body: string | ReactNode
  /** OK button label */
  okLabel?: string
  /** Cancel button label */
  cancelLabel?: string
  /** 'danger' makes the OK button red (for destructive actions like delete) */
  variant?: 'default' | 'danger'
}

export function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title,
  body,
  okLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  variant = 'default',
}: ConfirmModalProps) {
  const titleId = 'confirm-modal-title'
  const showTitle = !!title

  const okClass =
    variant === 'danger'
      ? 'flex-1 px-6 py-3 bg-error text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-error/90 transition-colors'
      : 'flex-1 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors'

  return (
    <CenterModal open={open} onClose={onCancel} ariaLabelledBy={showTitle ? titleId : undefined}>
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
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 border border-outline text-on-surface rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={okClass}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </CenterModal>
  )
}
