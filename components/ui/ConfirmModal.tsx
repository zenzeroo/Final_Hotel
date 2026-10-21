'use client'

import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { useT } from '@/lib/i18n/useT'

/**
 * Phase 27.A — Replaces browser-native `confirm()`. Centered modal
 * with title + body + Cancel/OK buttons. Cancel button receives
 * onCancel, OK button receives onConfirm.
 *
 * Phase 31.A — Now a thin wrapper over the canonical `<Modal>`
 * primitive. API unchanged.
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
  okLabel,
  cancelLabel,
  variant = 'default',
}: ConfirmModalProps) {
  const t = useT()
  okLabel ??= t('customer.common.confirm')
  cancelLabel ??= t('customer.common.cancel')
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      body={body}
      actions={[
        { label: cancelLabel, onClick: onCancel, variant: 'ghost' },
        {
          label: okLabel,
          onClick: onConfirm,
          variant: variant === 'danger' ? 'danger' : 'primary',
        },
      ]}
      variant="confirm"
    />
  )
}