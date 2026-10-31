import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Pagination } from '@/components/ui/Pagination'
import { Tabs } from '@/components/ui/Tabs'
import { ResolveNoteButton } from './ResolveNoteButton'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { localizedName } from '@/lib/format/roomType'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

type Status = 'open' | 'resolved' | 'all'

// `label` is a dictionary key.
const NOTE_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  request: { label: 'reception.requestsPage.typeRequest', color: 'bg-primary/10 text-primary', icon: 'help' },
  complaint: { label: 'reception.requestsPage.typeComplaint', color: 'bg-error/10 text-error', icon: 'report' },
  compliment: { label: 'reception.requestsPage.typeCompliment', color: 'bg-primary/10 text-primary', icon: 'favorite' },
  general: { label: 'reception.requestsPage.typeGeneral', color: 'bg-surface-container text-on-surface-variant', icon: 'info' },
}

interface GuestNoteRow {
  id: string
  note_type: string
  title: string
  body: string
  created_at: string
  is_resolved: boolean
  guest: { full_name: string } | null
  booking: { booking_code: string; room_type: { name: string; name_th: string | null } | null } | null
}

/**
 * Guest requests / complaints / compliments logged on a booking (from the
 * booking detail). Reception works through the open ones and resolves them.
 */
export default async function GuestRequestsPage(props: PageProps<'/reception/requests'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const searchParams = await props.searchParams
  const rawStatus = typeof searchParams.status === 'string' ? searchParams.status : 'open'
  const status: Status = rawStatus === 'resolved' || rawStatus === 'all' ? rawStatus : 'open'
  const pageParam = Number(searchParams.page ?? 1)
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  let listQuery = supabase
    .from('guest_notes')
    .select(
      `
      *,
      guest:profiles!guest_notes_guest_id_fkey(full_name, phone),
      booking:bookings!guest_notes_booking_id_fkey(booking_code, room_type:room_types(name, name_th))
    `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + PAGE_SIZE - 1)
  if (status === 'open') listQuery = listQuery.eq('is_resolved', false)
  else if (status === 'resolved') listQuery = listQuery.eq('is_resolved', true)

  // Every tab shows its own real count, not only the one on screen.
  const countOf = (resolved: boolean) =>
    supabase.from('guest_notes').select('id', { count: 'exact', head: true }).eq('is_resolved', resolved)
  const [list, openCount, resolvedCount] = await Promise.all([listQuery, countOf(false), countOf(true)])

  const header = (
    <header className="mb-8">
      <h1 className="font-headline-md text-headline-md text-primary">{t('reception.requestsPage.heading')}</h1>
      <p className="text-body-lg text-on-surface-variant mt-2">{t('reception.requestsPage.subtitle')}</p>
    </header>
  )

  if (list.error || openCount.error || resolvedCount.error) {
    return (
      <div className="p-8 lg:p-12 max-w-7xl">
        {header}
        <div role="alert" className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 flex items-start gap-3">
          <MaterialIcon name="error" size={22} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-body-md font-semibold text-on-surface">{t('reception.requestsPage.loadFailed')}</p>
            <a
              href={`/reception/requests?status=${status}`}
              className="inline-flex mt-2 text-body-md text-primary underline underline-offset-4"
            >
              {t('reception.requestsPage.retry')}
            </a>
          </div>
        </div>
      </div>
    )
  }

  const notes = (list.data ?? []) as GuestNoteRow[]
  const total = list.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (total > 0 && page > totalPages) {
    redirect(`/reception/requests?status=${status}${totalPages > 1 ? `&page=${totalPages}` : ''}`)
  }
  const open = openCount.count ?? 0
  const resolved = resolvedCount.count ?? 0

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      {header}

      <Tabs
        active={status}
        tabs={[
          { key: 'open', label: t('reception.requestsPage.tabOpen'), href: '/reception/requests?status=open', badge: open },
          {
            key: 'resolved',
            label: t('reception.requestsPage.tabResolved'),
            href: '/reception/requests?status=resolved',
            badge: resolved,
          },
          { key: 'all', label: t('reception.requestsPage.tabAll'), href: '/reception/requests?status=all', badge: open + resolved },
        ]}
      />

      {notes.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-lg shadow-level-1">
          <MaterialIcon name="forum" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">
            {status === 'open' ? t('reception.requestsPage.emptyOpen') : t('reception.requestsPage.emptyAny')}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {notes.map((n) => {
              const meta = NOTE_TYPE_META[n.note_type] ?? NOTE_TYPE_META.general
              return (
                <article key={n.id} className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold ${meta.color}`}
                        >
                          <MaterialIcon name={meta.icon} size={14} />
                          {t(meta.label)}
                        </span>
                        <span className="text-caption text-on-surface-variant">
                          {formatDateTime(n.created_at, LOCALE_BCP47[locale])}
                        </span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-primary">{n.title}</h3>
                      <p className="text-body-md text-on-surface mt-1 whitespace-pre-wrap">{n.body}</p>
                      <div className="mt-3 pt-3 border-t border-outline-variant flex items-center gap-4 flex-wrap text-caption text-on-surface-variant">
                        {n.guest && (
                          <span className="inline-flex items-center gap-1.5">
                            <MaterialIcon name="person" size={14} />
                            {n.guest.full_name}
                          </span>
                        )}
                        {n.booking && (
                          <span className="inline-flex items-center gap-1.5">
                            <MaterialIcon name="bookmark" size={14} />
                            <span className="font-mono">{n.booking.booking_code}</span>
                            {n.booking.room_type && ` · ${localizedName(n.booking.room_type, locale)}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {!n.is_resolved && <ResolveNoteButton noteId={n.id} />}
                    {n.is_resolved && (
                      <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-caption font-semibold">
                        <MaterialIcon name="check_circle" size={14} />
                        {t('reception.requestsPage.resolved')}
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/reception/requests"
            extraParams={{ status }}
          />
        </>
      )}
    </div>
  )
}
