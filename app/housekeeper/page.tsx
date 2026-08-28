import { getSession } from '@/lib/supabase/getSession'
import { getMyDashboardStatsForUser, getAllRoomUnits } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { ShiftProgress } from '@/components/housekeeping/ShiftProgress'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'สวัสดีตอนเช้า'
  if (h < 18) return 'สวัสดีตอนบ่าย'
  return 'สวัสดีตอนเย็น'
}

export default async function HousekeeperDashboard() {
  const session = await getSession()
  const stats = await getMyDashboardStatsForUser(session!.id)
  const roomUnits = await getAllRoomUnits()
  const name = session!.fullName ?? 'พนักงานทำความสะอาด'

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          {greeting()}, {name}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">ภาพรวมกะของคุณ</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">ห้องที่ต้องทำความสะอาด</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.roomsToClean}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">ความคืบหน้ากะ</p>
          <ShiftProgress percent={stats.shiftProgress} />
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">งานของฉัน</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.myTasksCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">งานซ่อมบำรุงที่เปิดอยู่</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.maintenanceOpenCount}</p>
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <MaterialIcon name="priority_high" size={24} className="text-error" />
            งานที่ต้องทำก่อน
          </h2>
        </div>
        {stats.priorityTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">ตอนนี้ไม่มีงานเร่งด่วน</p>
        ) : (
          <div className="space-y-3">
            {stats.priorityTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-2">
          <MaterialIcon name="task_alt" size={24} />
          งานที่กำลังทำของฉัน
        </h2>
        {stats.activeTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">ไม่มีงานที่กำลังทำ ลองดูงานในกลุ่มที่ยังไม่ได้รับ</p>
        ) : (
          <div className="space-y-3">
            {stats.activeTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section className="flex justify-end">
        <MaintenanceReportModal roomUnits={roomUnits} />
      </section>
    </div>
  )
}