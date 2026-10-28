import { notFound } from 'next/navigation'
import { StaffBookingDetail } from '@/components/booking/StaffBookingDetail'
import { isUuid } from '@/lib/ids'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/**
 * Reception booking detail with the check-in / check-out / cancel actions.
 * Reached only from /reception/check-in-out; every other entry point opens
 * the read-only /reception/bookings/[id].
 */
export default async function ReceptionCheckInOutDetailPage(props: PageProps<'/reception/check-in-out/[id]'>) {
  const { id } = await props.params
  if (!isUuid(id)) notFound()
  const locale = await getLocale()
  const t = getT(locale)
  return (
    <StaffBookingDetail
      bookingId={id}
      backHref="/reception/check-in-out"
      backLabel={t('bookingDetailStaff.backCheckInOut')}
      showActions
      locale={locale}
    />
  )
}
