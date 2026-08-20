import type { WorkHistoryData } from '@/lib/data/types'

export function DailyPerformanceChart({ data }: { data: WorkHistoryData['dailyPerformance'] }) {
  const max = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="w-full">
      <div className="flex items-end gap-2 h-40 mb-2">
        {data.map((d) => {
          const heightPct = (d.count / max) * 100
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="relative w-full h-full flex items-end">
                <div
                  className="w-full bg-secondary rounded-t-md transition-all duration-500"
                  style={{ height: `${heightPct}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                  title={`${d.date}: ${d.count} tasks`}
                />
              </div>
              <span className="text-caption text-on-surface-variant mt-1.5">{d.date}</span>
              <span className="text-caption font-semibold text-primary">{d.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}