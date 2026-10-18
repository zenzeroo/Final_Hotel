'use client'

/**
 * Phase 27.B — app-wide toast / snackbar system.
 *
 * Replaces the blocking `AlertModal` for one-line, transient success /
 * error notices. `AlertModal` stays for content the user must read and
 * acknowledge (refund breakdowns, allocation summaries, generated
 * passwords).
 *
 * Mounted once in `app/layout.tsx` (inside `<I18nProvider>`), so a toast
 * fired right before `router.push()` survives the navigation.
 *
 *   const toast = useToast()
 *   toast.error(result.error)
 *   toast.success(t('manager.staffPage.shiftSaved'))
 *
 * Messages must already be localized — the provider only localizes its
 * own chrome (close button).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastOptions {
  title?: string
  /** Override the auto-dismiss delay. */
  durationMs?: number
}

export interface ToastApi {
  success: (message: string, opts?: ToastOptions) => void
  error: (message: string, opts?: ToastOptions) => void
  info: (message: string, opts?: ToastOptions) => void
}

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  title?: string
  durationMs: number
}

const MAX_VISIBLE = 3
const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 5000,
  info: 5000,
  error: 8000,
}

const KIND_STYLE: Record<ToastKind, { box: string; icon: string }> = {
  success: {
    box: 'bg-secondary-container text-on-secondary-container',
    icon: 'check_circle',
  },
  error: {
    box: 'bg-error-container text-on-error-container',
    icon: 'error',
  },
  info: {
    box: 'bg-surface-container-highest text-on-surface',
    icon: 'info',
  },
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>.')
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string, opts?: ToastOptions) => {
    if (!message) return
    const item: ToastItem = {
      id: nextId.current++,
      kind,
      message,
      title: opts?.title,
      durationMs: opts?.durationMs ?? DEFAULT_DURATION[kind],
    }
    setItems((prev) => [...prev, item].slice(-MAX_VISIBLE))
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, opts) => push('success', message, opts),
      error: (message, opts) => push('error', message, opts),
      info: (message, opts) => push('info', message, opts),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-6 md:bottom-6 md:items-end md:px-0"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const t = useT()
  const [paused, setPaused] = useState(false)
  const remaining = useRef(item.durationMs)
  const startedAt = useRef(0)

  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const timer = setTimeout(() => onDismiss(item.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, item.id, onDismiss])

  const style = KIND_STYLE[item.kind]

  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-(--shadow-ambient-lg) animate-toast-in ${style.box}`}
    >
      <MaterialIcon name={style.icon} size={20} filled className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1 text-label-md">
        {item.title && <p className="font-semibold">{item.title}</p>}
        <p className="whitespace-pre-line break-words">{item.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={t('ui.toast.close')}
        className="-mr-1 flex-shrink-0 rounded-full p-1 transition-colors duration-200 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <MaterialIcon name="close" size={18} />
      </button>
    </div>
  )
}
