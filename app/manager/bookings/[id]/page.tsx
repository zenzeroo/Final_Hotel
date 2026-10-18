import { notFound } from 'next/navigation'
import { StaffBookingDetail } from '@/components/booking/StaffBookingDetail'
import { isUuid } from '@/lib/ids'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/**
 * Phase 54 — manager booking detail (read-only). Same view as reception's
 * `/reception/bookings/[id]` minus the action section; access is gated by
 * `app/manager/layout.tsx` (manager/admin).
 */
export default async function ManagerBookingDetailPage(props: PageProps<'/manager/bookings/[id]'>) {
  const { id } = await props.params
  if (!isUuid(id)) notFound()
  const locale = await getLocale()
  const t = getT(locale)
  return (
    <StaffBookingDetail
      bookingId={id}
      backHref="/manager/bookings"
      backLabel={t('bookingDetailStaff.backManager')}
      showActions={false}
      locale={locale}
    />
  )
}
