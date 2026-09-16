'use client'

/**
 * Phase 31.A — Modal primitive. Typed wrapper around `CenterModal` with
 * title/body/actions contract + optional X close button. The 6 hand-rolled
 * dialogs that previously duplicated the backdrop markup now use this
 * (or AlertModal/ConfirmModal which now wrap this internally).
 *
 * Backdrop, Escape key, click-outside, role/aria still come from
 * `CenterModal`. This component adds the header + body + optional footer.
 *
 * Two layouts:
 * - With `actions`: renders a footer row of buttons below body. Use for
 *   AlertModal/ConfirmModal-style confirm dialogs (no form in body).
 * - Without `actions`: body must include its own buttons (typical for
 *   form-based dialogs — the form element wraps both inputs and submit).
 */
import { useId } from 'react'
import { CenterModal } from './CenterModal'
import { MaterialIcon } from './MaterialIcon'
import { useT } from '@/lib/i18n/useT'

export type ModalVariant = 'default' | 'alert' | 'confirm' | 'danger'
export type ModalActionVariant = 'primary' | 'danger' | 'ghost'

export interface ModalAction {
  label: string
  onClick: () => void
  variant?: ModalActionVariant
  disabled?: boolean
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** Title text (short, bold) — optional */
  title?: string | React.ReactNode
  /** Body — string split on \n into paragraphs, or ReactNode (e.g. a <form>) */
  body: string | React.ReactNode
  /**
   * Optional footer action buttons. Omit when body contains a <form>
   * with its own submit/cancel buttons inside.
   */
  actions?: ModalAction[]
  /** Affects default button layout/colors when actions is provided. */
  variant?: ModalVariant
  /** Default true — backdrop click closes the dialog */
  closeOnBackdrop?: boolean
  /** Width class for the inner card — default 'max-w-md' */
  maxWidthClass?: string
  /** Show the X close button in header — default false (AlertModal/ConfirmModal UX). Form modals pass true. */
  showCloseButton?: boolean
}

function actionClass(v: ModalActionVariant = 'primary'): string {
  const base =
    'rounded-lg font-semibold text-label-md uppercase tracking-wider transition-colors'
  if (v === 'danger') {
    return `${base} bg-error text-on-primary hover:bg-error/90 disabled:opacity-50`
  }
  if (v === 'ghost') {
    return `${base} border border-outline text-on-surface hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed disabled:opacity-50`
  }
  return `${base} bg-primary text-on-primary hover:bg-primary-fixed hover:text-primary disabled:opacity-50`
}

export function Modal({
  open,
  onClose,
  title,
  body,
  actions,
  variant: _variant = 'default',
  closeOnBackdrop = true,
  maxWidthClass = 'max-w-md',
  showCloseButton = false,
}: ModalProps) {
  const t = useT()
  const reactId = useId()
  const titleId = `modal-title-${reactId}`
  const showTitle = !!title

  // Body string with \n is split into paragraphs (matches AlertModal pattern).
  const bodyContent =
    typeof body === 'string'
      ? body.split('\n').map((line, i) => (
          <p key={i} className={i > 0 ? 'mt-2' : ''}>
            {line}
          </p>
        ))
      : body

  // Action layout: 1 action → full-width; >1 action → row of equal buttons.
  const isSingleAction = actions && actions.length === 1

  return (
    <CenterModal
      open={open}
      onClose={onClose}
      ariaLabelledBy={showTitle ? titleId : undefined}
      closeOnBackdrop={closeOnBackdrop}
      maxWidthClass={maxWidthClass}
    >
      <div className="flex flex-col gap-4">
        {showTitle && (
          <div className="flex items-center justify-between gap-2">
            <h2
              id={titleId}
              className="font-display text-xl font-bold text-primary text-center flex-1"
            >
              {title}
            </h2>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('ui.modal.close')}
                className="p-1 rounded-md hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                <MaterialIcon name="close" size={20} />
              </button>
            )}
          </div>
        )}
        <div className="text-body-md text-on-surface">{bodyContent}</div>
        {actions && actions.length > 0 && (
          <div
            className={
              isSingleAction
                ? 'mt-2'
                : 'flex flex-col sm:flex-row gap-3 mt-2'
            }
          >
            {actions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={
                  isSingleAction
                    ? `w-full inline-flex items-center justify-center px-6 py-3 ${actionClass(action.variant)}`
                    : `flex-1 px-6 py-3 ${actionClass(action.variant)}`
                }
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </CenterModal>
  )
}