import { getSession } from '@/lib/supabase/getSession'
import { getMyTasksForUser, getUnassignedTasks } from '@/lib/data/housekeeper'
import { getNextCheckInForRooms } from '@/lib/data/manager'
import { getLocale } from '@/lib/i18n/getLocale'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { TaskCard } from '@/components/housekeeping/TaskCard'

export const dynamic = 'force-dynamic'

export default async function MyTasksPage() {
  const session = await getSession()
  const locale = await getLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'

  const [myTasks, unassigned] = await Promise.all([
    getMyTasksForUser(session!.id),
    getUnassignedTasks(),
  ])

  // Phase 30 — merge next-check-in ETA into each task from the view.
  const allRoomUnitIds = [
    ...myTasks.map((t) => t.room_unit_id),
    ...unassigned.map((t) => t.room_unit_id),
  ]
  const uniqueRoomIds = [...new Set(allRoomUnitIds)]
  const nextCheckInMap = await getNextCheckInForRooms(uniqueRoomIds)
  const attachEta = (t: typeof myTasks[number]) => ({
    ...t,
    next_check_in: nextCheckInMap.get(t.room_unit_id) ?? null,
  })
  const myTasksWithEta = myTasks.map(attachEta)
  const unassignedWithEta = unassigned.map(attachEta)

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">งานของฉัน</h1>
        <p className="text-body-lg text-on-surface-variant">งานที่มอบหมายให้คุณและกลุ่มงานที่ยังไม่มีคนรับ</p>
      </header>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          งานของฉัน ({myTasksWithEta.length})
        </h2>
        {myTasksWithEta.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">ตอนนี้ไม่มีงานมอบหมายให้คุณ ลองรับงานจากกลุ่มด้านล่าง</p>
        ) : (
          <div className="space-y-3">
            {myTasksWithEta.map(t => (
              <TaskCard key={t.id} task={t} variant="my" localeBcp={localeBcp} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          กลุ่มงานที่ยังไม่มีคนรับ ({unassignedWithEta.length})
        </h2>
        {unassignedWithEta.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">ไม่มีงานค้างในกลุ่ม ทำได้ดีมาก!</p>
        ) : (
          <div className="space-y-3">
            {unassignedWithEta.map(t => (
              <TaskCard key={t.id} task={t} variant="unassigned" localeBcp={localeBcp} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}