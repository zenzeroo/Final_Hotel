import { notFound } from 'next/navigation'
import { StaffBookingDetail } from '@/components/booking/StaffBookingDetail'
import { isUuid } from '@/lib/ids'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/** Where the read-only view was opened from → back link. */
const BACK: Record<string, { href: string; label: string }> = {
  bookings: { href: '/reception/bookings', label: 'bookingDetailStaff.backReception' },
  history: { href: '/reception/history', label: 'bookingDetailStaff.backHistory' },
  dashboard: { href: '/reception', label: 'bookingDetailStaff.backDashboard' },
}

/**
 * Reception booking detail — read-only. Opened from the bookings list,
 * history and the dashboard, so looking at a booking can never check it in
 * or cancel it by mistake. The actions live on /reception/check-in-out/[id].
 */
export default async function ReceptionBookingDetailPage(props: PageProps<'/reception/bookings/[id]'>) {
  const { id } = await props.params
  if (!isUuid(id)) notFound()
  const { from } = await props.searchParams
  const back = BACK[typeof from === 'string' ? from : ''] ?? BACK.bookings
  const locale = await getLocale()
  const t = getT(locale)
  return (
    <StaffBookingDetail
      bookingId={id}
      backHref={back.href}
      backLabel={t(back.label)}
      showActions={false}
      readOnlyChip
      locale={locale}
    />
  )
}
