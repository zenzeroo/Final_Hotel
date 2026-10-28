import Link from 'next/link'
import { getRecentEvents, type RecentEvent } from '@/lib/data/staff'
import { formatDateTime, isValidIsoDate } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { HistoryFilters } from './HistoryFilters'

export const dynamic = 'force-dynamic'

const TONE = {
  good: 'bg-primary/10 text-primary',
  stay: 'bg-secondary/20 text-secondary',
  bad: 'bg-error/10 text-error',
  muted: 'bg-surface-container text-on-surface-variant',
}

/**
 * Events reception acts on. System bookkeeping (temp holds acquired/released,
 * payment-deadline extensions, refund-rule ticks) is left out so desk events
 * are not pushed off the list. `label` is a dictionary key.
 */
const EVENT_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  created: { label: 'reception.historyPage.evCreated', color: TONE.good, icon: 'add_circle' },
  temp_hold_completed: { label: 'reception.historyPage.evBookedOnline', color: TONE.good, icon: 'add_circle' },
  confirmed: { label: 'reception.historyPage.evConfirmed', color: TONE.good, icon: 'verified' },
  checked_in: { label: 'reception.historyPage.evCheckedIn', color: TONE.stay, icon: 'login' },
  checked_out: { label: 'reception.historyPage.evCheckedOut', color: TONE.muted, icon: 'logout' },
  cancelled: { label: 'reception.historyPage.evCancelled', color: TONE.bad, icon: 'cancel' },
  paid: { label: 'reception.historyPage.evPaid', color: TONE.good, icon: 'credit_card' },
  payment_confirmed: { label: 'reception.historyPage.evPaymentConfirmed', color: TONE.good, icon: 'credit_card' },
  payment_recovered: { label: 'reception.historyPage.evPaymentRecovered', color: TONE.good, icon: 'credit_card' },
  refund_requested: { label: 'reception.historyPage.evRefundRequested', color: TONE.muted, icon: 'request_quote' },
  refund_approved: { label: 'reception.historyPage.evRefundApproved', color: TONE.muted, icon: 'currency_exchange' },
  refund_rejected: { label: 'reception.historyPage.evRefundRejected', color: TONE.bad, icon: 'block' },
  refund_confirmed: { label: 'reception.historyPage.evRefundConfirmed', color: TONE.muted, icon: 'currency_exchange' },
  auto_refund: { label: 'reception.historyPage.evAutoRefund', color: TONE.muted, icon: 'currency_exchange' },
  note_added: { label: 'reception.historyPage.evNoteAdded', color: TONE.muted, icon: 'note_add' },
  status_changed: { label: 'reception.historyPage.evStatusChanged', color: TONE.muted, icon: 'sync' },
}

const SHOWN_EVENT_TYPES = Object.keys(EVENT_TYPE_META)

/** Dropdown categories, in display order; 'all' = every type above. */
const CATEGORIES: { value: string; label: string; types: readonly string[] }[] = [
  { value: 'all', label: 'reception.historyPage.catAll', types: SHOWN_EVENT_TYPES },
  { value: 'booking', label: 'reception.historyPage.catBooking', types: ['created', 'temp_hold_completed', 'confirmed'] },
  { value: 'stay', label: 'reception.historyPage.catStay', types: ['checked_in', 'checked_out'] },
  { value: 'payment', label: 'reception.historyPage.catPayment', types: ['paid', 'payment_confirmed', 'payment_recovered'] },
  { value: 'cancel', label: 'reception.historyPage.catCancel', types: ['cancelled'] },
  {
    value: 'refund',
    label: 'reception.historyPage.catRefund',
    types: ['refund_requested', 'refund_approved', 'refund_rejected', 'refund_confirmed', 'auto_refund'],
  },
  { value: 'other', label: 'reception.historyPage.catOther', types: ['note_added', 'status_changed'] },
]

/** Shared by the heading row and every event row so the columns line up (md+). */
const GRID = 'md:grid md:grid-cols-[11rem_minmax(0,2fr)_minmax(0,1.4fr)_9.5rem] md:gap-x-4'

const ROLE_LABEL: Record<string, string> = {
  user: 'reception.historyPage.roleUser',
  reception: 'reception.historyPage.roleReception',
  housekeeper: 'reception.historyPage.roleHousekeeper',
  manager: 'reception.historyPage.roleManager',
  admin: 'reception.historyPage.roleAdmin',
}

export default async function ActionHistoryPage(props: PageProps<'/reception/history'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const category = CATEGORIES.find((c) => c.value === searchParams.category) ?? CATEGORIES[0]
  // Optional Bangkok-day range; invalid values are ignored, a reversed pair swapped.
  let from = typeof searchParams.from === 'string' && isValidIsoDate(searchParams.from) ? searchParams.from : ''
  let to = typeof searchParams.to === 'string' && isValidIsoDate(searchParams.to) ? searchParams.to : ''
  if (from && to && from > to) [from, to] = [to, from]
  const filtered = q.trim().length >= 2 || category.value !== 'all' || !!from || !!to
  const events = await getRecentEvents({
    // Unfiltered = the latest activity; a filtered view may need to reach further back.
    limit: filtered ? 200 : 50,
    eventTypes: category.types,
    search: q,
    from: from || undefined,
    to: to || undefined,
  })

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{t('reception.historyPage.heading')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('reception.historyPage.subtitle', { count: events.length })}
        </p>
      </div>

      <div className="mb-6">
        <HistoryFilters
          initialQuery={q}
          initialFrom={from}
          initialTo={to}
          category={category.value}
          categories={CATEGORIES.map(({ value, label }) => ({ value, label }))}
        />
      </div>

      {events.length === 0 && filtered ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="search_off" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">{t('reception.historyPage.noMatch')}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="history" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">{t('reception.historyPage.empty')}</p>
          <p className="text-caption text-on-surface-variant mt-1">
            {t('reception.historyPage.emptyHint')}
          </p>
        </div>
      ) : (
        <>
          <div
            aria-hidden="true"
            className={`hidden ${GRID} px-4 pb-2 text-caption text-on-surface-variant uppercase tracking-wider font-semibold`}
          >
            <span>{t('reception.historyPage.event')}</span>
            <span>{t('reception.historyPage.colBooking')}</span>
            <span>{t('reception.historyPage.colActor')}</span>
            <span className="text-right">{t('reception.historyPage.colWhen')}</span>
          </div>
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id}>
                <EventRow event={e} t={t} dateLocale={LOCALE_BCP47[locale]} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function EventRow({
  event: e,
  t,
  dateLocale,
}: {
  event: RecentEvent
  t: ReturnType<typeof getT>
  dateLocale: string
}) {
  const meta = EVENT_TYPE_META[e.event_type]
  const actorRole = e.actor ? (ROLE_LABEL[e.actor.role] ? t(ROLE_LABEL[e.actor.role]) : e.actor.role) : null
  const rowClass =
    `flex flex-wrap items-center gap-x-4 gap-y-2 ${GRID} px-4 py-3 bg-surface-container-low rounded-xl transition-colors`

  const content = (
    <>
      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold w-44 max-w-full ${meta.color}`}>
        <MaterialIcon name={meta.icon} size={14} />
        <span className="truncate">{t(meta.label)}</span>
      </span>
      <span className="flex-[2] min-w-40 md:min-w-0 truncate">
        <span className="font-mono text-body-md font-bold text-on-surface">
          {e.booking?.booking_code ?? (e.booking_id ? `#${e.booking_id.slice(0, 8)}` : '—')}
        </span>
        {e.booking?.booker_full_name && (
          <span className="text-body-md text-on-surface-variant"> · {e.booking.booker_full_name}</span>
        )}
      </span>
      <span className="flex-1 min-w-32 md:min-w-0 inline-flex items-center gap-1.5 text-caption text-on-surface-variant truncate">
        <MaterialIcon name={e.actor ? 'person' : 'smart_toy'} size={14} />
        {e.actor ? `${e.actor.full_name ?? '—'} · ${actorRole}` : t('reception.historyPage.system')}
      </span>
      <span className="ml-auto shrink-0 text-caption text-on-surface-variant md:text-right">
        {formatDateTime(e.created_at, dateLocale)}
      </span>
    </>
  )

  return e.booking_id ? (
    <Link
      href={`/reception/bookings/${e.booking_id}?from=history`}
      className={`${rowClass} hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-secondary`}
    >
      {content}
    </Link>
  ) : (
    <div className={rowClass}>{content}</div>
  )
}
