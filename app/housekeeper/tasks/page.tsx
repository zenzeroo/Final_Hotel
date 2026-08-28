import { getSession } from '@/lib/supabase/getSession'
import { getMyTasksForUser, getUnassignedTasks } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'

export const dynamic = 'force-dynamic'

export default async function MyTasksPage() {
  const session = await getSession()
  const [myTasks, unassigned] = await Promise.all([
    getMyTasksForUser(session!.id),
    getUnassignedTasks(),
  ])

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">งานของฉัน</h1>
        <p className="text-body-lg text-on-surface-variant">งานที่มอบหมายให้คุณและกลุ่มงานที่ยังไม่มีคนรับ</p>
      </header>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          งานของฉัน ({myTasks.length})
        </h2>
        {myTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">ตอนนี้ไม่มีงานมอบหมายให้คุณ ลองรับงานจากกลุ่มด้านล่าง</p>
        ) : (
          <div className="space-y-3">
            {myTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          กลุ่มงานที่ยังไม่มีคนรับ ({unassigned.length})
        </h2>
        {unassigned.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">ไม่มีงานค้างในกลุ่ม ทำได้ดีมาก!</p>
        ) : (
          <div className="space-y-3">
            {unassigned.map(t => <TaskCard key={t.id} task={t} variant="unassigned" />)}
          </div>
        )}
      </section>
    </div>
  )
}