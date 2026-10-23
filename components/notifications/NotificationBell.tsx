'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n/useT'
import { formatTHB } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/app/actions/notifications'
import {
  NOTIFICATION_ICON,
  type NotificationParams,
  type NotificationRow,
} from '@/lib/notifications/types'

const PAGE_SIZE = 20

interface NotificationBellProps {
  userId: string
  /** Which edge the panel lines up with — 'left' for the staff sidebar. */
  align?: 'left' | 'right'
  /** Button colours for the surface it sits on. */
  tone?: 'light' | 'dark'
}

/**
 * Phase 60 — notification bell with a realtime unread badge.
 * Rows are read with the browser client (RLS: owner only) and new rows
 * arrive over Supabase Realtime `postgres_changes`.
 */
export function NotificationBell({ userId, align = 'right', tone = 'light' }: NotificationBellProps) {
  const t = useT()
  const toast = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const render = useCallback(
    (n: Pick<NotificationRow, 'type' | 'params'>) => t(`notifications.types.${n.type}`, formatParams(n.params, t)),
    [t],
  )

  // Initial load + realtime subscription.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function load() {
      const [list, count] = await Promise.all([
        supabase
          .from('notifications')
          .select('id, type, params, link, read_at, created_at')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .is('read_at', null),
      ])
      if (cancelled) return
      if (list.error || count.error) {
        setLoadFailed(true)
        return
      }
      setLoadFailed(false)
      setItems((list.data ?? []) as NotificationRow[])
      setUnread(count.count ?? 0)
    }
    void load()

    // Realtime checks RLS with the socket's JWT. On first mount the browser
    // client hasn't loaded the session yet, so join only after handing the
    // access token to Realtime — otherwise the channel runs as anon and
    // every row is filtered out.
    const subscribe = () =>
      supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as NotificationRow
            setItems((prev) => [row, ...prev.filter((p) => p.id !== row.id)].slice(0, PAGE_SIZE))
            setUnread((n) => n + 1)
            toast.info(render(row))
          },
        )
        .subscribe()

    let channel: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) await supabase.realtime.setAuth(data.session.access_token)
      if (cancelled) return
      channel = subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
    // render/toast change identity with locale; resubscribing for that is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function markRead(id: string) {
    const target = items.find((i) => i.id === id)
    if (!target || target.read_at) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)))
    setUnread((n) => Math.max(0, n - 1))
    startTransition(() => {
      void markNotificationReadAction(id)
    })
  }

  function markAll() {
    const now = new Date().toISOString()
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })))
    setUnread(0)
    startTransition(() => {
      void markAllNotificationsReadAction()
    })
  }

  function onItemClick(n: NotificationRow) {
    markRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const badge = unread > 9 ? '9+' : String(unread)
  const buttonTone =
    tone === 'dark'
      ? 'text-secondary hover:bg-primary-container focus-visible:outline-secondary'
      : 'text-on-surface hover:bg-primary-fixed focus-visible:outline-primary'

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `${t('notifications.open')} — ${t('notifications.unreadCount', { count: unread })}` : t('notifications.open')}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${buttonTone}`}
      >
        <MaterialIcon name="notifications" size={22} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-error text-on-error text-[11px] font-semibold leading-5 text-center"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label={t('notifications.title')}
          className={`absolute top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-surface-container-lowest text-on-surface shadow-(--shadow-ambient-lg) border border-outline-variant overflow-hidden ${align === 'left' ? 'left-0' : 'right-0'}`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-outline-variant">
            <h2 className="text-body-lg font-semibold">{t('notifications.title')}</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-label-md text-primary hover:underline rounded focus-visible:outline-2 focus-visible:outline-primary"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {loadFailed ? (
            <p className="px-4 py-8 text-center text-body-md text-on-surface-variant">{t('notifications.loadFailed')}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-md text-on-surface-variant">{t('notifications.empty')}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-outline-variant">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${n.read_at ? '' : 'bg-secondary-container/40'}`}
                  >
                    <MaterialIcon name={NOTIFICATION_ICON[n.type] ?? 'notifications'} size={20} className="mt-0.5 shrink-0 text-primary" />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-body-md ${n.read_at ? 'text-on-surface-variant' : 'font-medium'}`}>
                        {render(n)}
                      </span>
                      <span className="block text-caption text-on-surface-variant mt-0.5">
                        {relativeTime(n.created_at, t)}
                      </span>
                    </span>
                    {!n.read_at && <span aria-hidden="true" className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

type Translate = (key: string, params?: Record<string, string | number>) => string

/** Turn stored params into display strings (money, dates, enum labels). */
function formatParams(params: NotificationParams, t: Translate): Record<string, string | number> {
  const out: Record<string, string | number> = { ...params }
  if (typeof params.amount === 'number') out.amount = formatTHB(params.amount)
  if (typeof params.checkIn === 'string') {
    const [y, m, d] = params.checkIn.split('-')
    if (y && m && d) out.checkIn = `${d}/${m}/${y}`
  }
  if (typeof params.severity === 'string') out.severity = t(`staff.severity.${params.severity}`)
  return out
}

function relativeTime(iso: string, t: Translate): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return t('notifications.justNow')
  if (mins < 60) return t('notifications.minutesAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('notifications.hoursAgo', { n: hours })
  return t('notifications.daysAgo', { n: Math.floor(hours / 24) })
}
