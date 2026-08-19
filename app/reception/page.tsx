import Link from 'next/link'
import { getTodayStats, getRecentBookings, getRoomsStatus } from '@/lib/data/staff'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export default async function ReceptionDashboard() {
  const [stats, recent, rooms] = await Promise.all([
    getTodayStats(),
    getRecentBookings(5),
    getRoomsStatus(),
  ])

  const roomStats = {
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    cleaning: rooms.filter((r) => r.status === 'cleaning').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-primary">แดชบอร์ด</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          ข้อมูลภาพรวมของโรงแรม ณ วันนี้
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="เช็คอินวันนี้"
          value={stats.todayCheckIns}
          icon="login"
          color="primary"
        />
        <StatCard
          label="เช็คเอาท์วันนี้"
          value={stats.todayCheckOuts}
          icon="logout"
          color="secondary"
        />
        <StatCard
          label="แขกที่พักอยู่"
          value={stats.inHouse}
          icon="group"
          color="primary"
        />
        <StatCard
          label="รอชำระเงิน"
          value={stats.pendingPayment}
          icon="credit_card"
          color="error"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bookings */}
        <section className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-primary">การจองล่าสุด</h2>
            <Link
              href="/reception/bookings"
              className="text-label-md text-primary font-semibold uppercase tracking-wider hover:text-secondary"
            >
              ดูทั้งหมด
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-body-md text-on-surface-variant text-center py-8">ยังไม่มีการจอง</p>
          ) : (
            <div className="flex flex-col">
              {recent.map((b) => (
                <Link
                  key={b.id}
                  href={`/reception/bookings`}
                  className="flex items-center gap-4 py-3 border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors -mx-2 px-2 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-semibold text-on-surface truncate">
                      {b.booker_full_name}
                    </p>
                    <p className="text-caption text-on-surface-variant">
                      {b.room_type?.name_th} · {formatDate(b.check_in)} – {formatDate(b.check_out)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-caption font-semibold ${statusClass(b.status, b.payment_status)}`}
                  >
                    {statusLabel(b.status, b.payment_status)}
                  </span>
                  <span className="shrink-0 text-body-md font-semibold text-primary">
                    {formatTHB(b.total)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Room Status */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">สถานะห้องพัก</h2>
          <div className="flex flex-col gap-3">
            <RoomStat label="ว่าง" value={roomStats.available} total={rooms.length} color="primary" />
            <RoomStat label="มีแขก" value={roomStats.occupied} total={rooms.length} color="secondary" />
            <RoomStat label="รอทำความสะอาด" value={roomStats.cleaning} total={rooms.length} color="tertiary" />
            <RoomStat label="ปรับปรุง" value={roomStats.maintenance} total={rooms.length} color="error" />
          </div>
          <Link
            href="/reception/rooms"
            className="mt-4 inline-flex items-center gap-2 text-label-md text-primary font-semibold uppercase tracking-wider hover:text-secondary"
          >
            ดูรายละเอียด
            <MaterialIcon name="arrow_forward" size={16} />
          </Link>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: string
  color: 'primary' | 'secondary' | 'error'
}) {
  const colorClass =
    color === 'primary'
      ? 'bg-primary/10 text-primary'
      : color === 'secondary'
      ? 'bg-secondary/20 text-secondary'
      : 'bg-error/10 text-error'
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-(--shadow-ambient) border border-outline-variant">
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">{label}</span>
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${colorClass}`}>
          <MaterialIcon name={icon} size={20} />
        </div>
      </div>
      <p className="font-display text-4xl font-bold text-primary">{value}</p>
    </div>
  )
}

function RoomStat({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: 'primary' | 'secondary' | 'tertiary' | 'error'
}) {
  const colorClass =
    color === 'primary'
      ? 'bg-primary'
      : color === 'secondary'
      ? 'bg-secondary'
      : color === 'tertiary'
      ? 'bg-tertiary'
      : 'bg-error'
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-body-md text-on-surface">{label}</span>
        <span className="text-body-md font-semibold text-on-surface">
          {value}/{total}
        </span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function statusLabel(status: string, paymentStatus: string) {
  if (status === 'cancelled') return 'ยกเลิก'
  if (status === 'checked_in') return 'เข้าพัก'
  if (status === 'checked_out') return 'เช็คเอาท์'
  if (paymentStatus === 'paid') return 'ชำระแล้ว'
  if (status === 'confirmed') return 'รอชำระ'
  return 'รอดำเนินการ'
}

function statusClass(status: string, paymentStatus: string) {
  if (status === 'cancelled') return 'bg-error/10 text-error'
  if (status === 'checked_in') return 'bg-primary/10 text-primary'
  if (status === 'checked_out') return 'bg-surface-container text-on-surface-variant'
  if (paymentStatus === 'paid') return 'bg-primary/10 text-primary'
  return 'bg-secondary/20 text-secondary'
}
