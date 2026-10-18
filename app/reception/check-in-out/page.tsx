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
      // Phase 12: list of rooms reception can assign during check-in.
      // Filtered to active + status='available'. Staff may also pick a
      // maintenance-status room (e.g. resolved between shifts) — but
      // the default UI restricts to available for safety.
      supabase
        .from('room_units')
        .select('id, unit_label, floor, room_type_id, status')
        .eq('is_active', true)
        .eq('status', 'available')
        .order('floor')
        .order('unit_label'),
    ])

  const list = listRes.data ?? []
  const upcomingCheckIns = upcomingCheckInsRes.data ?? []
  const upcomingCheckOuts = upcomingCheckOutsRes.data ?? []
  const inHouse = inHouseRes.data ?? []
  // availableUnits may be undefined if RLS blocks; treat as empty.
  const allAvailableUnits = availableUnitsRes.data ?? []

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
          two are hidden (not just collapsed/scrolled past). The search
          input lives inside the "วันนี้" section since per spec the
          search applies to the active view's data — the today view is
          the only one where the search currently has wired-up query
          filters (see listQuery + upcomingCheckInsQuery +
          upcomingCheckOutsQuery + inHouseQuery). */}
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
      )}

      {activeView === 'upcoming' && (
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary/15 text-secondary">
              <MaterialIcon name="schedule" size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl text-primary">{upcomingTitle}</h2>
              <p className="text-caption text-on-surface-variant">
                {formatDate(upcomingFrom, LOCALE_BCP47[locale])} – {formatDate(upcomingTo, LOCALE_BCP47[locale])}
              </p>
            </div>
            <span className="ml-auto px-3 py-1 rounded-full bg-secondary text-on-secondary text-caption font-semibold">
              {upcoming.length}
            </span>
          </div>
          {upcoming.length === 0 ? (
            <EmptyStateWithCta locale={locale} message={upcomingEmptyLabel} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcoming.map((b) => (
                <UpcomingCard
                  locale={locale}
                  key={b.id}
                  booking={b}
                  topic={activeTab}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeView === 'inhouse' && (
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-secondary">
              <MaterialIcon name="group" size={20} />
            </div>
            <h2 className="font-display text-xl text-primary">{t('reception.checkInOutPage.inHouseTitle')}</h2>
            <span className="ml-auto px-3 py-1 rounded-full bg-primary text-secondary text-caption font-semibold">
              {inHouse.length}
            </span>
          </div>
          {inHouse.length === 0 ? (
            <EmptyStateWithCta locale={locale} message={t('reception.checkInOutPage.noInHouseGuests')} />
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
                    {t('reception.checkInOutPage.checkoutOn', { date: formatDate(b.check_out, LOCALE_BCP47[locale]) })}
                  </div>
                  <div className="mt-1 text-caption text-on-surface-variant">
                    {t('reception.common.guestsN', { count: b.guests })} · {formatTHB(b.total)}
                  </div>
                </Link>
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

function GuestCard({
  booking,
  action,
  locale,
}: {
  locale: Locale
  booking: GuestCardBooking
  action: React.ReactNode
}) {
  const t = getT(locale)
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
          {booking.room_type?.name_th} · {t('reception.common.guestsN', { count: booking.guests })}
        </p>
        <p className="text-caption text-on-surface-variant mt-0.5 font-mono">
          #{booking.booking_code}
        </p>
      </Link>
      <div className="shrink-0">{action}</div>
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

function UpcomingCard({
  booking,
  topic,
  locale,
}: {
  locale: Locale
  booking: UpcomingBooking
  topic: CheckInOutTopic
}) {
  const t = getT(locale)
  // Phase 48e — UpcomingCard now takes the topic so the action verb
  // matches the active direction (เช็คอิน vs เช็คเอาท์) and the date
  // label in the card footer reads correctly for both.
  const eventVerb = t(topic === 'checkin' ? 'reception.checkInOutPage.checkIn' : 'reception.checkInOutPage.checkOut')
  const eventDateIso = topic === 'checkin' ? booking.check_in : booking.check_out
  const eventDateColumn = topic === 'checkin' ? 'check_in' : 'check_out'
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
        {booking.room_type?.name_th} · {t('reception.common.guestsN', { count: booking.guests })}
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-caption text-on-surface-variant">
        <MaterialIcon name="event" size={14} />
        {t('reception.checkInOutPage.eventOn', { verb: eventVerb, date: formatDate(eventDateIso, LOCALE_BCP47[locale]) })}
      </div>
      <div className="mt-1 flex items-center justify-between text-caption text-on-surface-variant">
        <span>{t('reception.common.nightsN', { count: booking.nights })}</span>
        <span>{formatTHB(booking.total)}</span>
      </div>
    </Link>
  )
}