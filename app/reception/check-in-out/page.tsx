import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  addDaysLocalIso,
  formatDate,
  formatDateRangeCompact,
  getTodayBangkok,
} from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { roomPlanNote, type RoomNote } from '@/lib/room-status-text'
import { CheckInOutDateRange } from './CheckInOutDateRange'
import { CheckInOutListSearch } from './CheckInOutListSearch'
import {
  CheckInOutTopicTabs,
  type CheckInOutTopic,
} from './CheckInOutTopicTabs'
import { Tabs } from '@/components/ui/Tabs'
import { getLocale } from '@/lib/i18n/getLocale'
import { localizedName } from '@/lib/format/roomType'
import { getT } from '@/lib/i18n/t'
import { inArrivalOrder, isCheckInReady, planRooms } from '@/lib/room-status'
import { getRoomNotReadyReasons } from '@/lib/data/staff'

export const dynamic = 'force-dynamic'

type CheckInOutView = 'today' | 'upcoming' | 'inhouse'

export default async function CheckInOutPage(props: PageProps<'/reception/check-in-out'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const searchParams = await props.searchParams

  // Phase 48c/48e — three independent URL-driven controls:
  //   ?tab=checkin|checkout      (topic toggle — default checkin, omitted)
  //   ?checkin=&checkout=        (date range — default today/today, omitted)
  //   ?view=today|upcoming|inhouse (view tabs — default today, omitted)
  // All three are independent — switching one preserves the other two.
  // Today uses Asia/Bangkok TZ via getTodayBangkok() — TZ-safe even
  // when the server runs in a different locale, and avoids the
  // off-by-one UTC bug for Bangkok users at 00:00-06:59.
  const today = getTodayBangkok()
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
  const rawView = typeof searchParams.view === 'string' ? searchParams.view : ''
  const activeView: CheckInOutView =
    rawView === 'upcoming' ? 'upcoming' : rawView === 'inhouse' ? 'inhouse' : 'today'
  // Phase 48d — server-side list search (guest name / booking code /
  // email). Server filters via .or() so the URL is shareable and the
  // empty-query state stays canonical (omitted from URL by the
  // CheckInOutListSearch client component).
  const rawQ = typeof searchParams.q === 'string' ? searchParams.q : ''
  const searchTerm = rawQ.trim()
  const isTodayRange = checkin === today && checkout === today

  const supabase = await createClient()
  // Upcoming window: ALWAYS today+1 → today+3, regardless of which
  // range reception is viewing. "Upcoming" conceptually means
  // "coming up from now," not from an arbitrary viewed date.
  const upcomingFrom = addDaysLocalIso(today, 1)
  const upcomingTo = addDaysLocalIso(today, 3)

  // "Today" list query — tab+range filtered. This drives both the
  // active "วันนี้" view and the count badge on its view-tab pill.
  let listQuery =
    activeTab === 'checkin'
      ? supabase
          .from('bookings')
          .select(`
            *,
            room_type:room_types(id, name, name_th, hero_image_key),
            room_unit:room_units(unit_label)
          `)
          .gte('check_in', checkin)
          .lte('check_in', checkout)
          .in('status', ['confirmed', 'checked_in'])
          .order('check_in')
      : supabase
          .from('bookings')
          .select(`
            *,
            room_type:room_types(id, name, name_th, hero_image_key),
            room_unit:room_units(unit_label)
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

  // Upcoming check-INs — used when view=upcoming AND topic=checkin.
  let upcomingCheckInsQuery = supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, name, name_th, hero_image_key),
      room_unit:room_units(unit_label)
    `)
    .gte('check_in', upcomingFrom)
    .lte('check_in', upcomingTo)
    .eq('status', 'confirmed')
    .order('check_in')
  if (searchTerm) {
    const pattern = `%${searchTerm}%`
    upcomingCheckInsQuery = upcomingCheckInsQuery.or(
      `booker_full_name.ilike.${pattern},booking_code.ilike.${pattern},booker_email.ilike.${pattern}`,
    )
  }

  // Phase 48e — Upcoming check-OUTs — used when view=upcoming AND
  // topic=checkout. Mirrors the upcoming check-ins query exactly,
  // just swapped check_in→check_out and order. status='confirmed'
  // (guests whose check-out is upcoming and who haven't checked in
  // yet — analogous to upcoming check-ins semantics).
  let upcomingCheckOutsQuery = supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, name, name_th, hero_image_key),
      room_unit:room_units(unit_label)
    `)
    .gte('check_out', upcomingFrom)
    .lte('check_out', upcomingTo)
    .eq('status', 'confirmed')
    .order('check_out')
  if (searchTerm) {
    const pattern = `%${searchTerm}%`
    upcomingCheckOutsQuery = upcomingCheckOutsQuery.or(
      `booker_full_name.ilike.${pattern},booking_code.ilike.${pattern},booker_email.ilike.${pattern}`,
    )
  }

  // In-house query — always real-time (not date/tab filtered). Only
  // applies the search filter when the in-house view is active so we
  // don't waste DB cycles when the user is on a different view.
  let inHouseQuery = supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, name, name_th, hero_image_key),
      room_unit:room_units(unit_label)
    `)
    .eq('status', 'checked_in')
    .order('check_out')
  if (searchTerm && activeView === 'inhouse') {
    const pattern = `%${searchTerm}%`
    inHouseQuery = inHouseQuery.or(
      `booker_full_name.ilike.${pattern},booking_code.ilike.${pattern},booker_email.ilike.${pattern}`,
    )
  }

  const [listRes, upcomingCheckInsRes, upcomingCheckOutsRes, inHouseRes, availableUnitsRes] =
    await Promise.all([
      listQuery,
      upcomingCheckInsQuery,
      upcomingCheckOutsQuery,
      inHouseQuery,
      // Phase 12: all active rooms. splitCheckInUnits (lib/room-status.ts)
      // keeps the 'available' / 'ready' ones as choices and names the
      // booked type's rooms that aren't ready yet. checkInBookingAction
      // re-checks and flips the chosen room to 'occupied'.
      supabase
        .from('room_units')
        .select('id, unit_label, floor, room_type_id, status, room_type:room_types(name_th)')
        .eq('is_active', true)
        .order('floor')
        .order('unit_label'),
    ])

  const list = (listRes.data ?? []) as ListBooking[]
  const upcomingCheckIns = (upcomingCheckInsRes.data ?? []) as ListBooking[]
  const upcomingCheckOuts = (upcomingCheckOutsRes.data ?? []) as ListBooking[]
  const inHouse = (inHouseRes.data ?? []) as ListBooking[]
  // availableUnits may be undefined if RLS blocks; treat as empty.
  const allAvailableUnits = (availableUnitsRes.data ?? []).map((u) => ({
    id: u.id as string,
    unit_label: u.unit_label as string,
    floor: u.floor as number,
    status: u.status as string,
    roomTypeId: u.room_type_id as string | null,
    roomTypeName: (u.room_type as { name_th?: string } | null)?.name_th ?? null,
  }))

  // Why the booked type's rooms aren't ready (guest staying, cleaning,
  // repair…) — only for rooms of types that confirmed bookings here await.
  const pendingTypeIds = new Set(
    [...list, ...upcomingCheckIns, ...upcomingCheckOuts]
      .filter((b) => b.status === 'confirmed')
      .map((b) => b.room_type_id as string),
  )
  const notReadyReasons = await getRoomNotReadyReasons(
    allAvailableUnits.filter((u) => u.roomTypeId && pendingTypeIds.has(u.roomTypeId) && !isCheckInReady(u.status)),
  )

  /**
   * Room column + room status per booking, in list order. A booking gets
   * its room only at check-in, so before that the row shows the ready room
   * of the booked type the check-in would most likely use — each ready room
   * once per list — or, when none is left, why the type's room can't take
   * the guest yet. The check-in itself (room choice, moves) is on [id].
   */
  const roomInfos = (bookings: ListBooking[]): Map<string, RoomInfo> => {
    const plans = planRooms(inArrivalOrder(bookings), allAvailableUnits)
    return new Map(
      bookings.map((b) => [
        b.id,
        roomPlanNote(plans.get(b.id) ?? { kind: 'none' }, notReadyReasons, t, b.check_out, LOCALE_BCP47[locale]),
      ]),
    )
  }

  // Topic-aware upcoming list — drives both the rendered content AND
  // the count badge on the "กำลังจะมา" view-tab pill.
  const upcoming = activeTab === 'checkin' ? upcomingCheckIns : upcomingCheckOuts

  // Count badges on view tabs. Always-live for inhouse.
  const viewCounts = {
    today: list.length,
    upcoming: upcoming.length,
    inhouse: inHouse.length,
  }

  // Dynamic label fragments — drive list title + empty state from the
  // active tab + selected range so the UI never lies about which
  // event/window it's showing. Single-day range → just the date;
  // multi-day → "A – B".
  const rangeLabel =
    checkin === checkout
      ? formatDate(checkin, LOCALE_BCP47[locale])
      : `${formatDate(checkin, LOCALE_BCP47[locale])} – ${formatDate(checkout, LOCALE_BCP47[locale])}`
  const topicVerb = t(activeTab === 'checkin' ? 'reception.checkInOutPage.verbCheckin' : 'reception.checkInOutPage.verbCheckout')
  const listTitle = isTodayRange
    ? t('reception.checkInOutPage.listToday', { verb: topicVerb })
    : t('reception.checkInOutPage.listRange', { verb: topicVerb, range: rangeLabel })
  const emptyLabel = isTodayRange
    ? t('reception.checkInOutPage.emptyToday', { verb: topicVerb })
    : t('reception.checkInOutPage.emptyRange', { verb: topicVerb, range: rangeLabel })
  const upcomingTitle = t('reception.checkInOutPage.upcomingTitle', { verb: topicVerb })
  const upcomingEmptyLabel = t('reception.checkInOutPage.upcomingEmpty', { verb: topicVerb })

  // View tabs keep the topic, the date range and the search. Defaults
  // (checkin topic, today range, today view) stay out of the URL.
  const viewHref = (view: CheckInOutView) => {
    const qs = new URLSearchParams()
    if (activeTab === 'checkout') qs.set('tab', 'checkout')
    if (checkin !== today) qs.set('checkin', checkin)
    if (checkout !== today) qs.set('checkout', checkout)
    if (view !== 'today') qs.set('view', view)
    if (searchTerm) qs.set('q', searchTerm)
    const suffix = qs.toString()
    return suffix ? `/reception/check-in-out?${suffix}` : '/reception/check-in-out'
  }
  const viewTabs = [
    {
      key: 'today' as const,
      label: isTodayRange ? t('reception.checkInOutPage.today') : formatDateRangeCompact(checkin, checkout),
      icon: activeTab === 'checkin' ? 'login' : 'logout',
      href: viewHref('today'),
      badge: viewCounts.today,
    },
    { key: 'upcoming' as const, label: t('reception.checkInOutPage.tabUpcoming'), icon: 'schedule', href: viewHref('upcoming'), badge: viewCounts.upcoming },
    { key: 'inhouse' as const, label: t('reception.checkInOutPage.tabInHouse'), icon: 'group', href: viewHref('inhouse'), badge: viewCounts.inhouse },
  ]

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">
            {t('reception.checkInOutPage.title')}
          </h1>
          {/* Mode switch: which event the lists below are about. */}
          <CheckInOutTopicTabs active={activeTab} today={today} checkin={checkin} checkout={checkout} />
        </div>
        <CheckInOutDateRange defaultCheckin={checkin} defaultCheckout={checkout} today={today} />
      </header>

      <Tabs active={activeView} tabs={viewTabs} />

      {/* Only the active view renders; ?q= filters that view's query. The
          check-in / check-out buttons live on the booking's own page. */}
      {activeView === 'today' && (
        <ListPanel title={listTitle} count={list.length} search={searchTerm}>
          {list.length === 0 ? (
            <EmptyStateWithCta locale={locale} message={emptyLabel} />
          ) : (
            <BookingTable bookings={list} infos={roomInfos(list)} locale={locale} />
          )}
        </ListPanel>
      )}

      {activeView === 'upcoming' && (
        <ListPanel
          title={upcomingTitle}
          note={`${formatDate(upcomingFrom, LOCALE_BCP47[locale])} – ${formatDate(upcomingTo, LOCALE_BCP47[locale])}`}
          count={upcoming.length}
          search={searchTerm}
        >
          {upcoming.length === 0 ? (
            <EmptyStateWithCta locale={locale} message={upcomingEmptyLabel} />
          ) : (
            <BookingTable bookings={upcoming} infos={roomInfos(upcoming)} locale={locale} />
          )}
        </ListPanel>
      )}

      {activeView === 'inhouse' && (
        <ListPanel title={t('reception.checkInOutPage.inHouseTitle')} count={inHouse.length} search={searchTerm}>
          {inHouse.length === 0 ? (
            <EmptyStateWithCta locale={locale} message={t('reception.checkInOutPage.noInHouseGuests')} />
          ) : (
            <BookingTable bookings={inHouse} infos={roomInfos(inHouse)} locale={locale} />
          )}
        </ListPanel>
      )}
    </div>
  )
}

interface ListBooking {
  id: string
  booking_code: string
  booker_full_name: string
  booker_email: string
  status: string
  check_in: string
  check_out: string
  room_type_id: string
  created_at: string
  room_type: { name: string; name_th: string | null } | null
  room_unit: { unit_label: string } | null
}

type RoomInfo = RoomNote

const TONE: Record<RoomInfo['tone'], { dot: string; text: string }> = {
  ready: { dot: 'bg-primary', text: 'text-primary' },
  problem: { dot: 'bg-error', text: 'text-error' },
  stay: { dot: 'bg-secondary', text: 'text-on-surface' },
}

/** One white panel per view: title + count, the search, then the table. */
function ListPanel({
  title,
  note,
  count,
  search,
  children,
}: {
  title: string
  note?: string
  count: number
  search: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-surface-container">
        <div className="min-w-0">
          <h2 className="font-display text-xl text-primary">
            {title} <span className="text-on-surface-variant tabular-nums">· {count}</span>
          </h2>
          {note && <p className="text-[14px] text-on-surface-variant mt-0.5 tabular-nums">{note}</p>}
        </div>
        <CheckInOutListSearch initialQuery={search} />
      </div>
      {children}
    </section>
  )
}

/**
 * Name, email, room, both dates and whether the room can take the guest.
 * The guest's name is a link stretched over the whole row, so a click
 * anywhere opens /reception/check-in-out/[id] (where the actions are).
 */
function BookingTable({
  bookings,
  infos,
  locale,
}: {
  bookings: ListBooking[]
  infos: Map<string, RoomInfo>
  locale: Locale
}) {
  const t = getT(locale)
  const bcp = LOCALE_BCP47[locale]
  const th = 'px-4 first:pl-5 md:first:pl-6 py-3 text-left text-[13px] font-medium text-on-surface-variant whitespace-nowrap'
  const td = 'px-4 first:pl-5 md:first:pl-6 py-4 align-top'
  return (
    <div className="overflow-x-auto overflow-y-hidden">
      <table className="w-full">
        <thead className="border-b border-surface-container">
          <tr>
            <th scope="col" className={th}>{t('reception.checkInOutPage.colName')}</th>
            <th scope="col" className={th}>{t('reception.checkInOutPage.colEmail')}</th>
            <th scope="col" className={th}>{t('reception.checkInOutPage.colRoom')}</th>
            <th scope="col" className={th}>{t('reception.checkInOutPage.colCheckIn')}</th>
            <th scope="col" className={th}>{t('reception.checkInOutPage.colCheckOut')}</th>
            <th scope="col" className={th}>{t('reception.checkInOutPage.colRoomStatus')}</th>
            <th scope="col" className="w-12"><span className="sr-only">{t('reception.checkInOutPage.open')}</span></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const info = infos.get(b.id)
            const tone = info ? TONE[info.tone] : TONE.stay
            return (
              <tr key={b.id} className="relative border-t border-surface-container first:border-t-0 hover:bg-surface-container-low transition-colors">
                <td className={td}>
                  <div className="min-w-40 max-w-56">
                    <Link
                      href={`/reception/check-in-out/${b.id}`}
                      className="text-body-md font-semibold text-on-surface [overflow-wrap:anywhere] after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-secondary focus-visible:after:-outline-offset-2"
                    >
                      {b.booker_full_name}
                    </Link>
                    <p className="text-[14px] text-on-surface-variant tabular-nums">{b.booking_code}</p>
                  </div>
                </td>
                <td className={`${td} text-body-md text-on-surface`}>
                  <span className="block max-w-56 truncate" title={b.booker_email}>{b.booker_email}</span>
                </td>
                <td className={td}>
                  <p className="text-body-lg font-semibold text-primary whitespace-nowrap">{info?.room ?? '—'}</p>
                  <p className="text-[14px] text-on-surface-variant min-w-36">{localizedName(b.room_type, locale)}</p>
                </td>
                <td className={`${td} text-body-md text-on-surface whitespace-nowrap tabular-nums`}>{formatDate(b.check_in, bcp)}</td>
                <td className={`${td} text-body-md text-on-surface whitespace-nowrap tabular-nums`}>{formatDate(b.check_out, bcp)}</td>
                <td className={td}>
                  {info && (
                    <p className={`flex items-start gap-2 text-body-md min-w-48 ${tone.text}`}>
                      <span aria-hidden className={`mt-2 w-2 h-2 rounded-full shrink-0 ${tone.dot}`} />
                      {info.note}
                    </p>
                  )}
                </td>
                <td className={`${td} pr-5 md:pr-6 text-right text-on-surface-variant`}>
                  <MaterialIcon name="chevron_right" size={20} aria-hidden />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmptyStateWithCta({ message, locale }: { message: string; locale: Locale }) {
  const t = getT(locale)
  // Phase 48f — empty states across all 3 views get a helpful "see all
  // bookings" link so reception isn't stuck at a dead end when no
  // results match the current filter.
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <MaterialIcon name="inbox" size={40} className="text-on-surface-variant" />
      <p className="text-body-md text-on-surface-variant">{message}</p>
      <Link
        href="/reception/bookings"
        className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-primary/10 text-primary text-body-md font-semibold hover:bg-primary/15 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        {t('reception.common.seeAllBookings')}
        <MaterialIcon name="arrow_forward" size={16} />
      </Link>
    </div>
  )
}
