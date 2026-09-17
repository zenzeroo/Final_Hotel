import { getSession } from '@/lib/supabase/getSession'
import { getMyTasksForUser, getUnassignedTasks } from '@/lib/data/housekeeper'
import { getNextCheckInForRooms } from '@/lib/data/manager'
import { getLocale } from '@/lib/i18n/getLocale'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { HousekeeperMyTasksTabs } from '@/components/housekeeping/HousekeeperMyTasksTabs'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

type Tab = 'mine' | 'unassigned'

export default async function MyTasksPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await props.searchParams
  const tab: Tab = (['mine', 'unassigned'] as Tab[]).includes((params.tab as Tab) ?? 'mine')
    ? ((params.tab as Tab) ?? 'mine')
    : 'mine'

  const session = await getSession()
  const locale = await getLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'

  const [myTasks, unassigned] = await Promise.all([
    getMyTasksForUser(session!.id),
    getUnassignedTasks(),
  ])

  // Phase 30 — merge next-check-in ETA into each task from the view.
  const allRoomUnitIds = [
    ...myTasks.map(t => t.room_unit_id),
    ...unassigned.map(t => t.room_unit_id),
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

      <HousekeeperMyTasksTabs
        active={tab}
        mineCount={myTasks.length}
        unassignedCount={unassigned.length}
      />

      {tab === 'mine' ? (
        <section>
          <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
            งานของฉัน ({myTasksWithEta.length})
          </h2>
          {myTasksWithEta.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-10 text-center">
              <MaterialIcon name="task_alt" size={48} className="text-on-surface-variant" />
              <p className="font-title-md text-title-md text-on-surface">ตอนนี้คุณยังไม่มีงานที่ได้รับมอบหมาย</p>
              <p className="text-body-md text-on-surface-variant">
                ลองดูงานในกลุ่ม{' '}
                <a href="/housekeeper/tasks?tab=unassigned" className="text-primary underline">
                  &quot;กลุ่มงานที่ยังไม่มีคนรับ&quot;
                </a>{' '}
                แล้วกดรับงาน
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTasksWithEta.map(t => (
                <TaskCard key={t.id} task={t} variant="my" localeBcp={localeBcp} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
            กลุ่มงานที่ยังไม่มีคนรับ ({unassignedWithEta.length})
          </h2>
          {unassignedWithEta.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-10 text-center">
              <MaterialIcon name="check_circle" size={48} className="text-primary" />
              <p className="font-title-md text-title-md text-on-surface">ไม่มีงานค้างในกลุ่ม ทำได้ดีมาก!</p>
              <p className="text-body-md text-on-surface-variant">
                ทุกงานถูกรับไปดำเนินการแล้ว — เช็งงานของคุณได้ที่เมนู{' '}
                <a href="/housekeeper/tasks?tab=mine" className="text-primary underline">
                  &quot;งานของฉัน&quot;
                </a>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unassignedWithEta.map(t => (
                <TaskCard key={t.id} task={t} variant="unassigned" localeBcp={localeBcp} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
