'use client'

import type { ReactNode } from 'react'
import { Modal } from './Modal'

/**
 * Phase 27.A — Replaces browser-native `alert()`. Centered modal
 * with title + body + single OK button. Body supports multi-line
 * strings (split by \n into <p> elements) or arbitrary ReactNode
 * for richer formatting.
 *
 * Phase 31.A — Now a thin wrapper over the canonical `<Modal>`
 * primitive. API unchanged so all existing call sites still work.
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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      body={body}
      actions={[{ label: okLabel, onClick: onClose }]}
      variant="alert"
    />
  )
}