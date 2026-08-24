import { getSession } from '@/lib/supabase/getSession'
import {
  getManagerDashboardStats,
  getBookingsOversight,
  listRoomUnits,
  listStaff,
} from '@/lib/data/manager'
import { KpiCard } from '@/components/manager/KpiCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

function today() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function AdminDashboard() {
  const session = await getSession()
  const [stats, bookingsOversight, units, staff] = await Promise.all([
    getManagerDashboardStats(),
    getBookingsOversight(),
    listRoomUnits(),
    listStaff(),
  ])

  const name = session?.fullName ?? 'Admin'
  const totalRooms = units.length
  const occupied = units.filter((u) => u.status === 'occupied').length
  const occupancyPct = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0
  const activeStaff = staff.filter((s) => s.is_active).length
  const pendingRefunds = bookingsOversight.refundRequests.length
  const recentActivity = bookingsOversight.auditLog.slice(0, 8)

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            Executive Overview
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            สวัสดี {name} · ภาพรวมการดำเนินงานของโรงแรม · {today()}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-body-md text-on-surface-variant bg-surface-container-low rounded-full px-4 py-2">
          <MaterialIcon name="shield_person" size={18} />
          Admin Portal
        </div>
      </header>

      {/* 4 KPI tiles */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <KpiCard label="อัตราเข้าพัก" icon="hotel">
          <div className="flex items-center gap-3">
            <p className="font-display-lg text-display-lg-mobile text-primary">
              {occupancyPct}%
            </p>
            <div
              className="relative w-12 h-12 rounded-full"
              style={{
                background: `conic-gradient(#082717 ${occupancyPct * 3.6}deg, #e3e3df 0deg)`,
              }}
              aria-hidden
            >
              <div className="absolute inset-1 rounded-full bg-surface-container-lowest" />
            </div>
          </div>
          <div className="text-caption text-on-surface-variant mt-2">
            {occupied} / {totalRooms} ห้อง
          </div>
        </KpiCard>

        <KpiCard label="การจองที่ใช้งานอยู่" icon="bookmark">
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {bookingsOversight.activeCount}
          </p>
          <div className="text-caption text-on-surface-variant mt-2">
            รอคืนเงิน {pendingRefunds} รายการ
          </div>
        </KpiCard>

        <KpiCard label="พนักงานที่ปฏิบัติงาน" icon="badge">
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {activeStaff}
          </p>
          <div className="text-caption text-on-surface-variant mt-2">
            จากทั้งหมด {staff.length} คน
          </div>
        </KpiCard>

        <KpiCard label="เช็คอิน / เช็คเอาท์วันนี้" icon="swap_horiz">
          <div className="flex items-center gap-4">
            <div>
              <p className="font-display-lg text-display-lg-mobile text-primary">
                {stats.checkInsToday}
              </p>
              <p className="text-caption text-on-surface-variant">in</p>
            </div>
            <div className="w-px h-10 bg-outline-variant" />
            <div>
              <p className="font-display-lg text-display-lg-mobile text-primary">
                {stats.checkOutsToday}
              </p>
              <p className="text-caption text-on-surface-variant">out</p>
            </div>
          </div>
        </KpiCard>
      </section>

      {/* Recent activity */}
      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          กิจกรรมล่าสุด
        </h2>
        {recentActivity.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-8 text-center text-on-surface-variant">
            ยังไม่มีกิจกรรม
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium">
                    เวลา
                  </th>
                  <th className="px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium">
                    รหัสเจ้าหน้าที่
                  </th>
                  <th className="px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium">
                    การกระทำ
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((entry, idx) => (
                  <tr
                    key={`${entry.timestamp}-${idx}`}
                    className="border-b border-outline-variant last:border-b-0"
                  >
                    <td className="px-4 py-3 text-body-md text-on-surface">
                      {new Date(entry.timestamp).toLocaleString('th-TH', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 text-body-md text-on-surface-variant">
                      {entry.staffId}
                    </td>
                    <td className="px-4 py-3 text-body-md text-on-surface">
                      {entry.action}
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
