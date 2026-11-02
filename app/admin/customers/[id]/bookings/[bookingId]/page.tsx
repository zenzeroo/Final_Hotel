import { notFound } from 'next/navigation'
import { StaffBookingDetail } from '@/components/booking/StaffBookingDetail'
import { isUuid } from '@/lib/ids'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/**
 * Admin view of one booking from a customer's history (read-only, the same
 * view reception and the manager use). Access is gated by app/admin/layout.tsx.
 */
export default async function AdminCustomerBookingPage(props: PageProps<'/admin/customers/[id]/bookings/[bookingId]'>) {
  const { id, bookingId } = await props.params
  if (!isUuid(id) || !isUuid(bookingId)) notFound()
  const locale = await getLocale()
  const t = getT(locale)
  return (
    <StaffBookingDetail
      bookingId={bookingId}
      backHref={`/admin/customers/${id}`}
      backLabel={t('bookingDetailStaff.backCustomer')}
      showActions={false}
      readOnlyChip
      locale={locale}
    />
  )
}
