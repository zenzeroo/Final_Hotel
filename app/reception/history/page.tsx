import Link from 'next/link'
import { getRecentEvents } from '@/lib/data/staff'
import { formatDateTime } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

// `label` is a dictionary key (reception.historyPage.ev*).
const EVENT_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  created: { label: 'reception.historyPage.evCreated', color: 'bg-primary/10 text-primary', icon: 'add_circle' },
  confirmed: { label: 'reception.historyPage.evConfirmed', color: 'bg-primary/10 text-primary', icon: 'verified' },
  checked_in: { label: 'reception.historyPage.evCheckedIn', color: 'bg-secondary/20 text-secondary', icon: 'login' },
  checked_out: { label: 'reception.historyPage.evCheckedOut', color: 'bg-surface-container text-on-surface-variant', icon: 'logout' },
  cancelled: { label: 'reception.historyPage.evCancelled', color: 'bg-error/10 text-error', icon: 'cancel' },
  paid: { label: 'reception.historyPage.evPaid', color: 'bg-primary/10 text-primary', icon: 'credit_card' },
  note_added: { label: 'reception.historyPage.evNoteAdded', color: 'bg-surface-container text-on-surface-variant', icon: 'note_add' },
  status_changed: { label: 'reception.historyPage.evStatusChanged', color: 'bg-surface-container text-on-surface-variant', icon: 'sync' },
}

const ROLE_LABEL: Record<string, string> = {
  user: 'reception.historyPage.roleUser',
  reception: 'reception.historyPage.roleReception',
  housekeeper: 'reception.historyPage.roleHousekeeper',
  manager: 'reception.historyPage.roleManager',
  admin: 'reception.historyPage.roleAdmin',
}

interface RecentEventRow {
  id: string
  event_type: string
  description: string
  created_at: string
  booking_id: string | null
  actor: { full_name: string; role: string }[]
}

export default async function ActionHistoryPage() {
  const locale = await getLocale()
  const t = getT(locale)
  const events = await getRecentEvents(50)

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{t('reception.historyPage.heading')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('reception.historyPage.subtitle', { count: events.length })}
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="history" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">{t('reception.historyPage.empty')}</p>
          <p className="text-caption text-on-surface-variant mt-1">
            {t('reception.historyPage.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-hidden">
          <ul className="divide-y divide-outline-variant">
            {events.map((e: RecentEventRow) => {
              const meta = EVENT_TYPE_META[e.event_type] ?? {
                label: e.event_type,
                color: 'bg-surface-container text-on-surface-variant',
                icon: 'event',
              }
              // Phase Y — events with a booking_id are wrapped in <Link>
              // so the whole row navigates to the booking detail page.
              // Events without booking_id (e.g. customer-suspension audit
              // rows from Phase 36 — booking_id is nullable) stay as
              // plain <li> with no click target.
              const content = (
                <>
                  <div className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${meta.color}`}>
                    <MaterialIcon name={meta.icon} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold ${meta.color}`}>
                        {t(meta.label)}
                      </span>
                      <span className="text-caption text-on-surface-variant">
                        {formatDateTime(e.created_at, LOCALE_BCP47[locale])}
                      </span>
                    </div>
                    <p className="text-body-md text-on-surface mt-1">{e.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-caption text-on-surface-variant">
                      {e.actor?.[0] && (
                        <span className="inline-flex items-center gap-1.5">
                          <MaterialIcon name="person" size={14} />
                          {e.actor[0].full_name} · {ROLE_LABEL[e.actor[0].role] ? t(ROLE_LABEL[e.actor[0].role]) : e.actor[0].role}
                        </span>
                      )}
                      {e.booking_id && (
                        <span className="inline-flex items-center gap-1.5 font-mono">
                          <MaterialIcon name="bookmark" size={14} />
                          booking/{e.booking_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )
              const liClass = 'px-5 py-4 flex items-start gap-3 hover:bg-primary-fixed transition-colors'
              return (
                <li key={e.id}>
                  {e.booking_id ? (
                    <Link
                      href={`/reception/bookings/${e.booking_id}`}
                      className={`${liClass} cursor-pointer focus-visible:outline-2 focus-visible:outline-secondary`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className={liClass}>{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
