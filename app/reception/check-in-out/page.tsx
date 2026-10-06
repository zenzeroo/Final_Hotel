import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatTHB } from '@/lib/pricing'
import {
  addDaysLocalIso,
  formatDate,
  getTodayLocalIso,
} from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { CheckInOutActions } from './CheckInOutActions'
import { CheckInOutDateRange } from './CheckInOutDateRange'
import { CheckInOutListSearch } from './CheckInOutListSearch'
import {
  CheckInOutTopicTabs,
  type CheckInOutTopic,
} from './CheckInOutTopicTabs'

export const dynamic = 'force-dynamic'

export default async function CheckInOutPage(props: PageProps<'/reception/check-in-out'>) {
  const searchParams = await props.searchParams

  // Phase 48c — tab + date-range both drive the page state.
  //   ?tab=checkin|checkout (default: checkin, omitted from URL)
  //   ?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD (default: today/today, omitted)
  // Both controls are independent — switching tab does not reset range
  // and vice versa. Today uses local TZ (getTodayLocalIso) to avoid
  // the off-by-one bug for Thai users west of UTC.
  const today = getTodayLocalIso()
  const isValidIso = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(new Date(s).getTime())
  const rawCheckin = typeof searchParams.checkin === 'string' ? searchParams.checkin : ''
  const rawCheckout = typeof searchParams.checkout === 'string' ? searchParams.checkout : ''
  const checkin = isValidIso(rawCheckin) ? rawCheckin : today
  let checkout = isValidIso(rawCheckout) ? rawCheckout : today
  // Self-correct: if the user provided an inverted range, bump
  // checkout to check-in + 1 (mirrors SearchBar's handleCheckinChange
  // clamp at SearchBar.tsx:124-138).
  if (checkout < checkin) {
    checkout = addDaysLocalIso(checkin, 1)
  }
  const rawTab = typeof searchParams.tab === 'string' ? searchParams.tab : ''
  const activeTab: CheckInOutTopic = rawTab === 'checkout' ? 'checkout' : 'checkin'
  // Phase 48d — server-side list search (guest name / booking code /
  // email). Server filters via .or() so the URL is shareable and the
  // empty-query state stays canonical (omitted from URL by the
  // CheckInOutListSearch client component).
  const rawQ = typeof searchParams.q === 'string' ? searchParams.q : ''
  const searchTerm = rawQ.trim()
  const isTodayRange = checkin === today && checkout === today

  const supabase = await createClient()
  // Upcoming check-ins window: ALWAYS today+1 → today+3, regardless of
  // which range or tab reception is viewing. "Upcoming" conceptually
  // means "coming up from now," not from an arbitrary viewed date.
  const upcomingFrom = addDaysLocalIso(today, 1)
  const upcomingTo = addDaysLocalIso(today, 3)

  // Single list, tab-aware query: tab=checkin uses check_in column with
  // [confirmed, checked_in] statuses (mirrors Phase 48 check-in card
  // semantics). tab=checkout uses check_out column with checked_in
  // status only (guests who have actually arrived).
  let listQuery =
    activeTab === 'checkin'
      ? supabase
          .from('bookings')
          .select(`
            *,
            room_type:room_types(id, name, name_th, hero_image_key)
          `)
          .gte('check_in', checkin)
          .lte('check_in', checkout)
          .in('status', ['confirmed', 'checked_in'])
          .order('check_in')
      : supabase
          .from('bookings')
          .select(`
            *,
            room_type:room_types(id, name, name_th, hero_image_key)
          `)
          .gte('check_out', checkin)
          .lte('check_out', checkout)
          .eq('status', 'checked_in')
          .order('check_out')
  // Phase 48d — narrow the already-tab+range-filtered list by guest
  // name / booking code / email. Case-insensitive ILIKE with `%q%`
  // substring match. Empty searchTerm → no .or() clause (full list).
  if (searchTerm) {
    const pattern = `%${searchTerm}%`
    listQuery = listQuery.or(
      `booker_full_name.ilike.${pattern},booking_code.ilike.${pattern},booker_email.ilike.${pattern}`,
    )
  }

  const [listRes, upcomingRes, inHouseRes, availableUnitsRes] = await Promise.all([
    listQuery,
    // Upcoming check-ins (next 3 days, confirmed only). Excludes today
    // (already in the list when tab=checkin) and in-house guests
    // (checked_in status would be misleading in this section).
    supabase
      .from('bookings')
      .select(`
        *,
        room_type:room_types(id, name, name_th, hero_image_key)
      `)
      .gte('check_in', upcomingFrom)
      .lte('check_in', upcomingTo)
      .eq('status', 'confirmed')
      .order('check_in'),
    supabase
      .from('bookings')
      .select(`
        *,
        room_type:room_types(id, name, name_th, hero_image_key)
      `)
      .eq('status', 'checked_in')
      .order('check_out'),
    // Phase 12: list of rooms reception can assign during check-in.
    // Filtered to active + status='available'. Staff may also pick a
    // maintenance-status room (e.g. resolved between shifts) — but the
    // default UI restricts to available for safety.
    supabase
      .from('room_units')
      .select('id, unit_label, floor, room_type_id, status')
      .eq('is_active', true)
      .eq('status', 'available')
      .order('floor')
      .order('unit_label'),
  ])

  const list = listRes.data ?? []
  const upcoming = upcomingRes.data ?? []
  const inHouse = inHouseRes.data ?? []
  // availableUnits may be undefined if RLS blocks; treat as empty.
  const allAvailableUnits = availableUnitsRes.data ?? []

  // Dynamic label fragments — drive list title + empty state from the
  // active tab + selected range so the UI never lies about which
  // event/window it's showing. Single-day range → just the date;
  // multi-day → "A – B".
  const rangeLabel =
    checkin === checkout
      ? formatDate(checkin)
      : `${formatDate(checkin)} – ${formatDate(checkout)}`
  const topicVerb = activeTab === 'checkin' ? 'เช็คอิน' : 'เช็คเอาท์'
  const listTitle = isTodayRange
    ? `${topicVerb}วันนี้`
    : `${topicVerb} ${rangeLabel}`
  const emptyLabel = isTodayRange
    ? `ไม่มี${topicVerb}วันนี้`
    : `ไม่มี${topicVerb} ${rangeLabel}`
  const actionVerb = activeTab === 'checkin' ? 'เช็คอิน' : 'เช็คเอาท์'

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">เช็คอิน / เช็คเอาท์</h1>
        <CheckInOutTopicTabs
          active={activeTab}
          today={today}
          checkin={checkin}
          checkout={checkout}
        />
        <CheckInOutDateRange
          defaultCheckin={checkin}
          defaultCheckout={checkout}
          today={today}
        />
      </div>

      {/* Single list view (tab + range filtered) */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
        <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${
                activeTab === 'checkin' ? 'bg-primary/10 text-primary' : 'bg-secondary/20 text-secondary'
              }`}
            >
              <MaterialIcon
                name={activeTab === 'checkin' ? 'login' : 'logout'}
                size={20}
              />
            </div>
            <h2 className="font-display text-xl text-primary">{listTitle}</h2>
            <span
              className={`px-3 py-1 rounded-full text-caption font-semibold ${
                activeTab === 'checkin'
                  ? 'bg-primary text-secondary'
                  : 'bg-secondary text-on-secondary'
              }`}
            >
              {list.length}
            </span>
          </div>
          <CheckInOutListSearch initialQuery={searchTerm} />
        </div>
        {list.length === 0 ? (
          <p className="text-body-md text-on-surface-variant text-center py-8">
            {emptyLabel}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((b) => {
              // Prefer units of the same room_type; fall back to any
              // available unit if none match the booking's type.
              const matchingType = allAvailableUnits.filter(
                (u) => u.room_type_id === b.room_type_id,
              )
              const availableForBooking =
                matchingType.length > 0 ? matchingType : allAvailableUnits
              return (
                <GuestCard
                  key={b.id}
                  booking={b}
                  action={
                    // For tab=checkin: show "เข้าพักแล้ว" badge if already
                    // checked_in, otherwise render the action button.
                    // For tab=checkout: bookings are pre-filtered to
                    // status='checked_in' so the action button is
                    // always shown.
                    activeTab === 'checkin' && b.status === 'checked_in' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-caption font-semibold">
                        <MaterialIcon name="verified" size={14} /> เข้าพักแล้ว
                      </span>
                    ) : (
                      <CheckInOutActions
                        bookingId={b.id}
                        action={activeTab === 'checkin' ? 'check_in' : 'check_out'}
                        label={actionVerb}
                        availableUnits={
                          activeTab === 'checkin' ? availableForBooking : undefined
                        }
                      />
                    )
                  }
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Phase X — Upcoming check-ins (next 3 days). Helps reception
          pre-assign rooms + flag VIP arrivals before guests show up.
          Read-only here — actual check-in happens on the day itself. */}
      <section className="mt-8 bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary/15 text-secondary">
            <MaterialIcon name="schedule" size={20} />
          </div>
          <div>
            <h2 className="font-display text-xl text-primary">เช็คอินที่กำลังจะมา</h2>
            <p className="text-caption text-on-surface-variant">
              {formatDate(upcomingFrom)} – {formatDate(upcomingTo)}
            </p>
          </div>
          <span className="ml-auto px-3 py-1 rounded-full bg-secondary text-on-secondary text-caption font-semibold">
            {upcoming.length}
          </span>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-body-md text-on-surface-variant text-center py-8">
            ไม่มีเช็คอินในช่วง 3 วันข้างหน้า
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcoming.map((b) => (
              <UpcomingCheckInCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      {/* In-house guests */}
      <section className="mt-8 bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-secondary">
            <MaterialIcon name="group" size={20} />
          </div>
          <h2 className="font-display text-xl text-primary">แขกที่พักอยู่ในขณะนี้</h2>
          <span className="ml-auto px-3 py-1 rounded-full bg-primary text-secondary text-caption font-semibold">
            {inHouse.length}
          </span>
        </div>
        {inHouse.length === 0 ? (
          <p className="text-body-md text-on-surface-variant text-center py-8">ไม่มีแขกที่เข้าพักอยู่</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inHouse.map((b) => (
              <Link
                key={b.id}
                href={`/reception/bookings/${b.id}`}
                className="block p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-secondary"
              >
                <p className="text-body-md font-semibold text-on-surface truncate">{b.booker_full_name}</p>
                <p className="text-caption text-on-surface-variant truncate">
                  {b.room_type?.name_th}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-caption text-on-surface-variant">
                  <MaterialIcon name="event" size={14} />
                  เช็คเอาท์ {formatDate(b.check_out)}
                </div>
                <div className="mt-1 text-caption text-on-surface-variant">
                  {b.guests} ท่าน · {formatTHB(b.total)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface GuestCardBooking {
  id: string
  booker_full_name: string
  room_type: { name_th: string } | null
  guests: number
  booking_code: string
}

interface UpcomingBooking extends GuestCardBooking {
  check_in: string
  check_out: string
  nights: number
  total: number
}

function GuestCard({
  booking,
  action,
}: {
  booking: GuestCardBooking
  action: React.ReactNode
}) {
  return (
    <div className="p-4 bg-surface-container-low rounded-xl flex items-center gap-3">
      <Link
        href={`/reception/bookings/${booking.id}`}
        className="flex-1 min-w-0 hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-secondary rounded-md"
      >
        <p className="text-body-md font-semibold text-on-surface truncate">
          {booking.booker_full_name}
        </p>
        <p className="text-caption text-on-surface-variant truncate">
          {booking.room_type?.name_th} · {booking.guests} ท่าน
        </p>
        <p className="text-caption text-on-surface-variant mt-0.5 font-mono">
          #{booking.booking_code}
        </p>
      </Link>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

function UpcomingCheckInCard({ booking }: { booking: UpcomingBooking }) {
  return (
    <Link
      href={`/reception/bookings/${booking.id}`}
      className="block p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-secondary"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-body-md font-semibold text-on-surface truncate">
          {booking.booker_full_name}
        </p>
        <span className="shrink-0 text-caption text-on-surface-variant font-mono">
          #{booking.booking_code}
        </span>
      </div>
      <p className="mt-1 text-caption text-on-surface-variant truncate">
        {booking.room_type?.name_th} · {booking.guests} ท่าน
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-caption text-on-surface-variant">
        <MaterialIcon name="event" size={14} />
        เช็คอิน {formatDate(booking.check_in)}
      </div>
      <div className="mt-1 flex items-center justify-between text-caption text-on-surface-variant">
        <span>{booking.nights} คืน</span>
        <span>{formatTHB(booking.total)}</span>
      </div>
    </Link>
  )
}