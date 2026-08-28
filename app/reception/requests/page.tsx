import { createClient } from '@/lib/supabase/server'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ResolveNoteButton } from './ResolveNoteButton'

export const dynamic = 'force-dynamic'

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const NOTE_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  request: { label: 'คำขอ', color: 'bg-primary/10 text-primary', icon: 'help' },
  complaint: { label: 'ข้อร้องเรียน', color: 'bg-error/10 text-error', icon: 'report' },
  compliment: { label: 'ชมเชย', color: 'bg-primary/10 text-primary', icon: 'favorite' },
  general: { label: 'ทั่วไป', color: 'bg-surface-container text-on-surface-variant', icon: 'info' },
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
        <h1 className="font-display text-3xl text-primary">คำขอ & บันทึกจากแขก</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          จัดการคำขอ ข้อร้องเรียน และข้อความจากแขก
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant mb-6">
        <TabButton label="ที่ยังไม่ปิด" count={status === 'open' ? notes.length : 0} active={status === 'open'} href="open" />
        <TabButton label="ปิดแล้ว" count={status === 'resolved' ? notes.length : 0} active={status === 'resolved'} href="resolved" />
        <TabButton label="ทั้งหมด" active={status === 'all'} href="all" />
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="forum" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">
            {status === 'open' ? 'ไม่มีคำขอที่รอดำเนินการ' : 'ไม่มีรายการ'}
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
                        {meta.label}
                      </span>
                      <span className="text-caption text-on-surface-variant">
                        {formatDateTime(n.created_at)}
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
                      ปิดแล้ว
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
