import { StaffBookingDetail } from '@/components/booking/StaffBookingDetail'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/**
 * Phase 46 — reception booking detail (with check-in/out + cancel actions).
 * Phase 54: body moved to the shared, localized `<StaffBookingDetail>`
 * (also used read-only by `/manager/bookings/[id]`).
 */
export default async function ReceptionBookingDetailPage(props: PageProps<'/reception/bookings/[id]'>) {
  const { id } = await props.params
  const locale = await getLocale()
  const t = getT(locale)
  return (
    <StaffBookingDetail
      bookingId={id}
      backHref="/reception/bookings"
      backLabel={t('bookingDetailStaff.backReception')}
      showActions
      locale={locale}
    />
  )
}
