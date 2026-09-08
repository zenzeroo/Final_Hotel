import { getSession } from '@/lib/supabase/getSession'
import { getMyWorkHistoryForUser, getAllWorkHistory } from '@/lib/data/housekeeper'
import { DailyPerformanceChart } from '@/components/housekeeping/DailyPerformanceChart'
import { TaskCard } from '@/components/housekeeping/TaskCard'

export const dynamic = 'force-dynamic'

export default async function WorkHistoryPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const params = await searchParams
  const session = await getSession()
  // Only admins may view all-hotel history; housekeepers see their own.
  const scope = params.scope === 'all' && session!.role === 'admin' ? 'all' : 'me'
  const data = scope === 'all'
    ? await getAllWorkHistory()
    : await getMyWorkHistoryForUser(session!.id)

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">วิเคราะห์ประวัติการทำงาน</h1>
        <p className="text-body-lg text-on-surface-variant">ติดตามผลงานกะของคุณตลอดช่วงเวลาที่ผ่านมา</p>
      </header>

      <nav className="flex gap-2 mb-8">
        <a
          href="/housekeeper/history"
          className={`px-4 py-1.5 rounded-full text-caption uppercase tracking-wider transition-colors ${
            scope === 'me' ? 'bg-primary text-secondary' : 'bg-surface-container text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
          }`}
        >
          ประวัติของฉัน
        </a>
        <a
          href="/housekeeper/history?scope=all"
          className={`px-4 py-1.5 rounded-full text-caption uppercase tracking-wider transition-colors ${
            scope === 'all' ? 'bg-primary text-secondary' : 'bg-surface-container text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
          }`}
        >
          ทั้งโรงแรม
        </a>
      </nav>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">ห้องที่ทำความสะอาดแล้ว</p>
          <p className="font-display-lg text-display-lg text-primary">{data.roomsCleaned}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">เวลาเฉลี่ย</p>
          <p className="font-display-lg text-display-lg text-primary">
            {data.avgMinutes !== null ? `${data.avgMinutes} นาที` : '—'}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">วันนี้</p>
          <p className="font-display-lg text-display-lg text-primary">{data.tasksToday}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">สัปดาห์นี้</p>
          <p className="font-display-lg text-display-lg text-primary">{data.tasksThisWeek}</p>
        </div>
      </section>

      <section className="mb-12 bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">ผลงานทำความสะอาดรายวัน</h2>
        <DailyPerformanceChart data={data.dailyPerformance} />
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">บันทึกงานล่าสุด</h2>
        {data.recentLog.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">ยังไม่มีงานที่เสร็จสิ้น</p>
        ) : (
          <div className="space-y-3">
            {data.recentLog.map(t => <TaskCard key={t.id} task={t} variant="history" />)}
          </div>
        )}
      </section>
    </div>
  )
}