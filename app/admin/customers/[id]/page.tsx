import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/supabase/getSession'
import { getCustomerById } from '@/lib/data/supabase-account'
import { getUserBookings } from '@/lib/data/bookings'
import { formatDate, formatDateTime } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { SuspendCustomerButton } from '@/components/admin/SuspendCustomerButton'
import { UnsuspendCustomerButton } from '@/components/admin/UnsuspendCustomerButton'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage(props: {
  params: Promise<{ id: string }>
}) {
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
        กลับไปหน้ารายชื่อลูกค้า
      </Link>

      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {customer.full_name ?? '(ไม่มีชื่อ)'}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            รายละเอียดลูกค้า
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
          ข้อมูลส่วนตัว
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailRow label="ชื่อ-นามสกุล" value={customer.full_name ?? '—'} />
          <DetailRow label="อีเมล" value={customer.email ?? '—'} />
          <DetailRow label="เบอร์โทร" value={customer.phone ?? '—'} />
          <DetailRow
            label="สมัครเมื่อ"
            value={formatDate(customer.created_at, 'th-TH')}
          />
        </div>
      </section>

      {/* Suspension info (if suspended) */}
      {customer.is_suspended && (
        <section className="bg-error-container/30 rounded-xl border border-error-container p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="block" size={20} className="text-error" />
            <h2 className="font-headline-sm text-headline-sm text-error">
              ข้อมูลการระงับ
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailRow
              label="ระงับเมื่อ"
              value={
                customer.suspended_at
                  ? formatDateTime(customer.suspended_at, 'th-TH')
                  : '—'
              }
            />
            <DetailRow
              label="เหตุผล"
              value={customer.suspended_reason ?? '—'}
            />
          </div>
        </section>
      )}

      {/* Booking history */}
      <section className="bg-surface-container-lowest rounded-xl shadow-level-1 border border-surface-container p-6">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          ประวัติการจอง ({bookings.length})
        </h2>
        {bookings.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">
            ยังไม่มีการจอง
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">รหัส</th>
                  <th className="text-left px-3 py-2 font-medium">เช็คอิน</th>
                  <th className="text-left px-3 py-2 font-medium">เช็คเอาท์</th>
                  <th className="text-right px-3 py-2 font-medium">คืน</th>
                  <th className="text-right px-3 py-2 font-medium">ยอด</th>
                  <th className="text-left px-3 py-2 font-medium">สถานะ</th>
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
                      {b.total.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2">
                      <BookingStatusBadge status={b.status} />
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

function BookingStatusBadge({
  status,
}: {
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
}) {
  const map = {
    pending: { label: 'รอดำเนินการ', cls: 'bg-surface-container-high text-on-surface-variant' },
    confirmed: { label: 'ยืนยัน', cls: 'bg-primary-container text-on-primary-container' },
    checked_in: { label: 'เช็คอิน', cls: 'bg-primary text-on-primary' },
    checked_out: { label: 'เช็คเอาท์', cls: 'bg-secondary-container text-on-secondary-container' },
    cancelled: { label: 'ยกเลิก', cls: 'bg-error-container text-on-error-container' },
  } as const
  const { label, cls } = map[status]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold ${cls}`}
    >
      {label}
    </span>
  )
}
