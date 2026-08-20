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
        <h1 className="font-headline-md text-headline-md text-primary mb-2">My Tasks</h1>
        <p className="text-body-lg text-on-surface-variant">Tasks assigned to you and the unassigned pool.</p>
      </header>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          My Tasks ({myTasks.length})
        </h2>
        {myTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No tasks assigned to you. Claim from the pool below.</p>
        ) : (
          <div className="space-y-3">
            {myTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          Unassigned Pool ({unassigned.length})
        </h2>
        {unassigned.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No tasks in the unassigned pool. Great work!</p>
        ) : (
          <div className="space-y-3">
            {unassigned.map(t => <TaskCard key={t.id} task={t} variant="unassigned" />)}
          </div>
        )}
      </section>
    </div>
  )
}