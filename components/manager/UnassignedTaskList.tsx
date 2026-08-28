import type { UnassignedTask } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDistanceToNow } from 'date-fns'

interface UnassignedTaskListProps {
  tasks: UnassignedTask[]
}

export function UnassignedTaskList({ tasks }: UnassignedTaskListProps) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">งานที่ยังไม่ได้มอบหมาย</h3>
      {tasks.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">งานทั้งหมดถูกมอบหมายแล้ว</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 border-b border-outline-variant pb-3 last:border-b-0 last:pb-0"
            >
              <MaterialIcon
                name={t.urgent ? 'priority_high' : 'checklist'}
                size={20}
                className={t.urgent ? 'text-error mt-0.5' : 'text-on-surface-variant mt-0.5'}
              />
              <div className="flex-1">
                <p className="text-body-md font-semibold text-primary">{t.title}</p>
                <p className="text-caption text-on-surface-variant">
                  ห้อง {t.roomNumber} ·{' '}
                  {formatDistanceToNow(new Date(t.requestedAt), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
