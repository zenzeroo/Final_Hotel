import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatTHB } from '@/lib/pricing'
import {
  addDaysLocalIso,
  formatDate,
  getTodayBangkok,
} from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { CheckInOutActions } from './CheckInOutActions'
import { CheckInOutDateRange } from './CheckInOutDateRange'
import { CheckInOutListSearch } from './CheckInOutListSearch'
import {
  CheckInOutTopicTabs,
  type CheckInOutTopic,
} from './CheckInOutTopicTabs'
import {
  CheckInOutViewTabs,
  type CheckInOutView,
} from './CheckInOutViewTabs'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { splitCheckInUnits } from '@/lib/room-status'

export const dynamic = 'force-dynamic'

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

  // Upcoming check-INs — used when view=upcoming AND topic=checkin.
  let upcomingCheckInsQuery = supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, name, name_th, hero_image_key)
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
      room_type:room_types(id, name, name_th, hero_image_key)
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
      room_type:room_types(id, name, name_th, hero_image_key)
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

  const list = listRes.data ?? []
  const upcomingCheckIns = upcomingCheckInsRes.data ?? []
  const upcomingCheckOuts = upcomingCheckOutsRes.data ?? []
  const inHouse = inHouseRes.data ?? []
  // availableUnits may be undefined if RLS blocks; treat as empty.
  const allAvailableUnits = (availableUnitsRes.data ?? []).map((u) => ({
    id: u.id as string,
    unit_label: u.unit_label as string,
    floor: u.floor as number,
    status: u.status as string,
    roomTypeId: u.room_type_id as string | null,
    roomTypeName: (u.room_type as { name_th?: string } | null)?.name_th ?? null,
  }))

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
  const actionVerb = t(activeTab === 'checkin' ? 'reception.checkInOutPage.checkIn' : 'reception.checkInOutPage.checkOut')
  const upcomingTitle = t('reception.checkInOutPage.upcomingTitle', { verb: topicVerb })
  const upcomingEmptyLabel = t('reception.checkInOutPage.upcomingEmpty', { verb: topicVerb })

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{t('reception.checkInOutPage.title')}</h1>

        {/* Phase 48f — Row 1: mode controls (topic toggle + date range).
            Wrapped in a flex container so they sit on one line on
            desktop and wrap to multiple lines on small viewports. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
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

        {/* Phase 48f — Row 2: view selector (today / upcoming / inhouse).
            Visually lighter than Row 1 (underline + light bg vs bold pill)
            so the two rows read as different layers of the UI. */}
        <CheckInOutViewTabs
          active={activeView}
          counts={viewCounts}
          today={today}
          checkin={checkin}
          checkout={checkout}
          activeTab={activeTab}
        />
      </div>

      {/* Phase 48e — only the active view is rendered below. The other
          two are hidden (not just collapsed/scrolled past). Each view's
          header has the search input; ?q= filters that view's query
          (listQuery / upcomingCheckInsQuery / upcomingCheckOutsQuery /
          inHouseQuery). */}
      {activeView === 'today' && (
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
            <EmptyStateWithCta locale={locale} message={emptyLabel} />
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((b) => {
                // The booked room type's ready room is the default; other
                // ready rooms only if reception says the booked one has a
                // problem (or it isn't ready).
                const { booked, others, bookedNotReady } = splitCheckInUnits(allAvailableUnits, b.room_type_id)
                return (
                  <BookingRow
                    locale={locale}
                    key={b.id}
                    booking={b}
                    action={
                      // For tab=checkin: show "เข้าพักแล้ว" badge if
                      // already checked_in, otherwise render the action
                      // button. For tab=checkout: bookings are
                      // pre-filtered to status='checked_in' so the
                      // action button is always shown.
                      activeTab === 'checkin' && b.status === 'checked_in' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-caption font-semibold">
                          <MaterialIcon name="verified" size={14} /> {t('reception.checkInOutPage.alreadyCheckedIn')}
                        </span>
                      ) : (
                        <CheckInOutActions
                          bookingId={b.id}
                          action={activeTab === 'checkin' ? 'check_in' : 'check_out'}
                          label={actionVerb}
                          bookedUnits={activeTab === 'checkin' ? booked : undefined}
                          otherUnits={activeTab === 'checkin' ? others : undefined}
                          bookedNotReady={activeTab === 'checkin' ? bookedNotReady : undefined}
                        />
                      )
                    }
                  />
                )
              })}
            </div>
          )}
        </section>
      )}

      {activeView === 'upcoming' && (
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary/15 text-secondary">
                <MaterialIcon name="schedule" size={20} />
              </div>
              <div>
                <h2 className="font-display text-xl text-primary">{upcomingTitle}</h2>
                <p className="text-caption text-on-surface-variant">
                  {formatDate(upcomingFrom, LOCALE_BCP47[locale])} – {formatDate(upcomingTo, LOCALE_BCP47[locale])}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-secondary text-on-secondary text-caption font-semibold">
                {upcoming.length}
              </span>
            </div>
            {/* ?q= already filters upcomingCheckInsQuery / upcomingCheckOutsQuery. */}
            <CheckInOutListSearch initialQuery={searchTerm} />
          </div>
          {upcoming.length === 0 ? (
            <EmptyStateWithCta locale={locale} message={upcomingEmptyLabel} />
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((b) => (
                <BookingRow
                  locale={locale}
                  key={b.id}
                  booking={b}
                  dateLabel={upcomingDateLabel(b, activeTab, locale)}
                  nights={b.nights}
                  total={b.total}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeView === 'inhouse' && (
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-secondary">
                <MaterialIcon name="group" size={20} />
              </div>
              <h2 className="font-display text-xl text-primary">{t('reception.checkInOutPage.inHouseTitle')}</h2>
              <span className="px-3 py-1 rounded-full bg-primary text-secondary text-caption font-semibold">
                {inHouse.length}
              </span>
            </div>
            {/* ?q= already filters inHouseQuery (only while this view is active). */}
            <CheckInOutListSearch initialQuery={searchTerm} />
          </div>
          {inHouse.length === 0 ? (
            <EmptyStateWithCta locale={locale} message={t('reception.checkInOutPage.noInHouseGuests')} />
          ) : (
            <div className="flex flex-col gap-2">
              {inHouse.map((b) => (
                <BookingRow
                  locale={locale}
                  key={b.id}
                  booking={b}
                  dateLabel={t('reception.checkInOutPage.checkoutOn', { date: formatDate(b.check_out, LOCALE_BCP47[locale]) })}
                  total={b.total}
                />
              ))}
            </div>
          )}
        </section>
      )}
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

/**
 * One compact row per booking (all three views): name + code, room ·
 * guests, then the optional date / nights / total, and the action outside
 * the link (a button must not sit inside an <a>). Wraps to two lines on
 * narrow screens.
 */
function BookingRow({
  booking,
  locale,
  dateLabel,
  nights,
  total,
  action,
}: {
  locale: Locale
  booking: GuestCardBooking
  dateLabel?: string
  nights?: number
  total?: number
  action?: React.ReactNode
}) {
  const t = getT(locale)
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-low rounded-xl hover:bg-surface-container transition-colors">
      <Link
        href={`/reception/bookings/${booking.id}`}
        // flex-wrap at every width: one line when it fits, otherwise the
        // fixed-width date / nights / total drop to a second line instead
        // of widening the page.
        className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md focus-visible:outline-2 focus-visible:outline-secondary"
      >
        <span className="w-full md:w-auto md:flex-[3] min-w-0 flex items-baseline gap-2">
          <span className="text-body-md font-semibold text-on-surface truncate">{booking.booker_full_name}</span>
          <span className="shrink-0 text-caption text-on-surface-variant font-mono">#{booking.booking_code}</span>
        </span>
        <span className="md:flex-[2] min-w-0 text-caption text-on-surface-variant truncate">
          {booking.room_type?.name_th} · {t('reception.common.guestsN', { count: booking.guests })}
        </span>
        {dateLabel && (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-caption text-on-surface-variant">
            <MaterialIcon name="event" size={14} />
            {dateLabel}
          </span>
        )}
        {nights !== undefined && (
          <span className="shrink-0 text-caption text-on-surface-variant">
            {t('reception.common.nightsN', { count: nights })}
          </span>
        )}
        {total !== undefined && (
          <span className="shrink-0 md:w-24 md:text-right text-caption font-semibold text-on-surface">
            {formatTHB(total)}
          </span>
        )}
      </Link>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function EmptyStateWithCta({ message, locale }: { message: string; locale: Locale }) {
  const t = getT(locale)
  // Phase 48f — empty states across all 3 views get a helpful "see all
  // bookings" link so reception isn't stuck at a dead end when no
  // results match the current filter.
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <MaterialIcon name="inbox" size={40} className="text-outline-variant" />
      <p className="text-body-md text-on-surface-variant">{message}</p>
      <Link
        href="/reception/bookings"
        className="inline-flex items-center gap-2 text-label-md text-primary font-semibold uppercase tracking-wider px-4 py-2 rounded-full bg-primary/10 hover:bg-primary-fixed transition-colors"
      >
        {t('reception.common.seeAllBookings')}
        <MaterialIcon name="arrow_forward" size={16} />
      </Link>
    </div>
  )
}

/** Phase 48e — the date label follows the topic (เช็คอิน vs เช็คเอาท์). */
function upcomingDateLabel(booking: UpcomingBooking, topic: CheckInOutTopic, locale: Locale): string {
  const t = getT(locale)
  const eventVerb = t(topic === 'checkin' ? 'reception.checkInOutPage.checkIn' : 'reception.checkInOutPage.checkOut')
  const eventDateIso = topic === 'checkin' ? booking.check_in : booking.check_out
  return t('reception.checkInOutPage.eventOn', { verb: eventVerb, date: formatDate(eventDateIso, LOCALE_BCP47[locale]) })
}