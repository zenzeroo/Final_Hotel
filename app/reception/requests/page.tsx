import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ResolveNoteButton } from './ResolveNoteButton'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

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
  booking: { booking_code: string; room_type: { name_th: string } | null } | null
}

export default async function GuestRequestsPage(props: PageProps<'/reception/requests'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const searchParams = await props.searchParams
  const status = typeof searchParams.status === 'string' ? searchParams.status : 'open'

  const supabase = await createClient()
  let query = supabase
    .from('guest_notes')
    .select(`
      *,
      guest:profiles!guest_notes_guest_id_fkey(full_name, phone),
      booking:bookings!guest_notes_booking_id_fkey(booking_code, room_type:room_types(name_th))
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status === 'open') {
    query = query.eq('is_resolved', false)
  } else if (status === 'resolved') {
    query = query.eq('is_resolved', true)
  }

  const { data, error } = await query
  if (error) {
    return <p className="p-8 text-error">Error: {error.message}</p>
  }

  const notes = data ?? []

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{t('reception.requestsPage.heading')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('reception.requestsPage.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant mb-6">
        <TabButton label={t('reception.requestsPage.tabOpen')} count={status === 'open' ? notes.length : 0} active={status === 'open'} href="open" />
        <TabButton label={t('reception.requestsPage.tabResolved')} count={status === 'resolved' ? notes.length : 0} active={status === 'resolved'} href="resolved" />
        <TabButton label={t('reception.requestsPage.tabAll')} active={status === 'all'} href="all" />
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="forum" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">
            {status === 'open' ? t('reception.requestsPage.emptyOpen') : t('reception.requestsPage.emptyAny')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((n: GuestNoteRow) => {
            const meta = NOTE_TYPE_META[n.note_type] ?? NOTE_TYPE_META.general
            return (
              <article
                key={n.id}
                className="bg-surface-container-lowest rounded-2xl p-5 shadow-(--shadow-ambient) border border-outline-variant"
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${meta.color}`}>
                    <MaterialIcon name={meta.icon} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold ${meta.color}`}>
                        {t(meta.label)}
                      </span>
                      <span className="text-caption text-on-surface-variant">
                        {formatDateTime(n.created_at, LOCALE_BCP47[locale])}
                      </span>
                    </div>
                    <h3 className="font-display text-lg text-primary">{n.title}</h3>
                    <p className="text-body-md text-on-surface mt-1 whitespace-pre-wrap">{n.body}</p>
                    <div className="mt-3 pt-3 border-t border-outline-variant flex items-center gap-4 text-caption text-on-surface-variant">
                      {n.guest && (
                        <span className="inline-flex items-center gap-1.5">
                          <MaterialIcon name="person" size={14} />
                          {n.guest.full_name}
                        </span>
                      )}
                      {n.booking && (
                        <span className="inline-flex items-center gap-1.5 font-mono">
                          <MaterialIcon name="bookmark" size={14} />
                          {n.booking.booking_code}
                          {n.booking.room_type && ` · ${n.booking.room_type.name_th}`}
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
      )}
    </div>
  )
}

function TabButton({ label, count, active, href }: { label: string; count?: number; active: boolean; href: string }) {
  return (
    <a
      href={`/reception/requests?status=${href}`}
      className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-secondary text-primary font-semibold'
          : 'border-transparent text-on-surface-variant hover:text-primary'
      }`}
    >
      <span className="text-label-md uppercase tracking-wider">{label}</span>
      {count !== undefined && (
        <span className={`px-2 py-0.5 rounded-full text-caption ${active ? 'bg-primary text-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
          {count}
        </span>
      )}
    </a>
  )
}
