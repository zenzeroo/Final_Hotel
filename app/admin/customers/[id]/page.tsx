import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/supabase/getSession'
import { getCustomerById } from '@/lib/data/supabase-account'
import { getUserBookings } from '@/lib/data/bookings'
import { formatDate, formatDateTime } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { SuspendCustomerButton } from '@/components/admin/SuspendCustomerButton'
import { UnsuspendCustomerButton } from '@/components/admin/UnsuspendCustomerButton'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const locale = await getLocale()
  const t = getT(locale)
  const { id } = await props.params
  const [session, customer] = await Promise.all([
    getSession(),
    getCustomerById(id),
  ])

  if (!customer) notFound()

  const bookings = await getUserBookings(customer.id)
  const isSelf = session?.id === customer.id

  return (
    <div className="p-8 lg:p-12 max-w-5xl">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4 transition-colors"
      >
        <MaterialIcon name="arrow_back" size={18} />
        {t('admin.customersPage.backToList')}
      </Link>

      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {customer.full_name ?? t('admin.common.noName')}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('admin.customersPage.detail.title')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isSelf &&
            (customer.is_suspended ? (
              <UnsuspendCustomerButton
                customerId={customer.id}
                customerName={customer.full_name}
              />
            ) : (
              <SuspendCustomerButton
                customerId={customer.id}
                customerName={customer.full_name}
              />
            ))}
        </div>
      </header>

      {/* Profile card */}
      <section className="bg-surface-container-lowest rounded-xl shadow-level-1 border border-surface-container p-6 mb-6">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('admin.customersPage.personalInfo')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailRow label={t('admin.common.fullName')} value={customer.full_name ?? '—'} />
          <DetailRow label={t('admin.common.email')} value={customer.email ?? '—'} />
          <DetailRow label={t('admin.common.phone')} value={customer.phone ?? '—'} />
          <DetailRow
            label={t('admin.customersPage.registeredAt')}
            value={formatDate(customer.created_at, LOCALE_BCP47[locale])}
          />
        </div>
      </section>

      {/* Suspension info (if suspended) */}
      {customer.is_suspended && (
        <section className="bg-error-container/30 rounded-xl border border-error-container p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="block" size={20} className="text-error" />
            <h2 className="font-headline-sm text-headline-sm text-error">
              {t('admin.customersPage.detail.suspensionInfo')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailRow
              label={t('admin.customersPage.detail.suspendedAt')}
              value={
                customer.suspended_at
                  ? formatDateTime(customer.suspended_at, LOCALE_BCP47[locale])
                  : '—'
              }
            />
            <DetailRow
              label={t('admin.customersPage.detail.suspendedReason')}
              value={customer.suspended_reason ?? '—'}
            />
          </div>
        </section>
      )}

      {/* Booking history */}
      <section className="bg-surface-container-lowest rounded-xl shadow-level-1 border border-surface-container p-6">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('admin.customersPage.historyCount', { count: bookings.length })}
        </h2>
        {bookings.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">
            {t('admin.customersPage.detail.noBookings')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{t('admin.customersPage.colCode')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('admin.customersPage.colCheckIn')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('admin.customersPage.colCheckOut')}</th>
                  <th className="text-right px-3 py-2 font-medium">{t('admin.customersPage.colNights')}</th>
                  <th className="text-right px-3 py-2 font-medium">{t('admin.customersPage.colTotal')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('admin.common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-primary-fixed transition-colors">
                    <td className="px-3 py-2 font-mono text-body-sm text-primary">
                      {b.booking_code}
                    </td>
                    <td className="px-3 py-2 text-body-sm">{b.check_in}</td>
                    <td className="px-3 py-2 text-body-sm">{b.check_out}</td>
                    <td className="px-3 py-2 text-body-sm text-right">
                      {b.nights}
                    </td>
                    <td className="px-3 py-2 text-body-sm text-right">
                      {b.total.toLocaleString(LOCALE_BCP47[locale])}
                    </td>
                    <td className="px-3 py-2">
                      <BookingStatusBadge status={b.status} label={t(BOOKING_STATUS_KEY[b.status])} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <span className="font-body-md text-body-md text-on-surface">{value}</span>
    </div>
  )
}

const BOOKING_STATUS_KEY = {
  pending: 'admin.customersPage.bsPending',
  confirmed: 'admin.customersPage.bsConfirmed',
  checked_in: 'admin.customersPage.bsCheckedIn',
  checked_out: 'admin.customersPage.bsCheckedOut',
  cancelled: 'admin.customersPage.bsCancelled',
  temp_pending: 'admin.customersPage.bsTempPending',
  expired: 'admin.customersPage.bsExpired',
  payment_expired: 'admin.customersPage.bsPaymentExpired',
} as const

function BookingStatusBadge({
  status,
  label,
}: {
  label: string
  // Phase 42 — added 'temp_pending' + 'expired' (Phase 42 temp bookings).
  // Phase 52 — added 'payment_expired' (30-min payment deadline lapsed).
  status:
    | 'pending'
    | 'confirmed'
    | 'checked_in'
    | 'checked_out'
    | 'cancelled'
    | 'temp_pending'
    | 'expired'
    | 'payment_expired'
}) {
  const map = {
    pending: { cls: 'bg-surface-container-high text-on-surface-variant' },
    confirmed: { cls: 'bg-primary-container text-on-primary-container' },
    checked_in: { cls: 'bg-primary text-on-primary' },
    checked_out: { cls: 'bg-secondary-container text-on-secondary-container' },
    cancelled: { cls: 'bg-error-container text-on-error-container' },
    temp_pending: { cls: 'bg-secondary-container text-on-secondary-container' },
    expired: { cls: 'bg-error-container text-on-error-container' },
    // Phase 52 — 30-min payment deadline lapsed
    payment_expired: { cls: 'bg-error-container text-on-error-container' },
  } as const
  const { cls } = map[status]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold ${cls}`}
    >
      {label}
    </span>
  )
}
