export function ShiftProgress({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="font-display-lg text-display-lg text-primary">{clamped}%</span>
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">Target: 12 rooms</span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div
          className="h-full bg-secondary transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}