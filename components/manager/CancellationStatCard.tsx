import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface CancellationStatCardProps {
  ratePct: number
  trendPct: number
  totalBookings: number
}

export function CancellationStatCard({
  ratePct,
  trendPct,
  totalBookings,
}: CancellationStatCardProps) {
  const isDown = trendPct < 0
  return (
    <div className="relative bg-primary text-secondary rounded-lg shadow-level-1 p-6 overflow-hidden">
      <div
        className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20"
        style={{
          background:
            'radial-gradient(circle, rgba(254,215,152,0.5) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative">
        <MaterialIcon name="event_busy" size={28} className="text-secondary mb-3" />
        <p className="text-label-md uppercase tracking-wider text-secondary/70">
          Cancellation Rate
        </p>
        <p className="font-display text-display-lg-mobile text-secondary mt-1">
          {ratePct.toFixed(1)}%
        </p>
        <div className="flex items-center gap-2 mt-3">
          <span
            className={`inline-flex items-center gap-1 text-caption px-2 py-1 rounded-full ${
              isDown
                ? 'bg-secondary text-on-secondary-container'
                : 'bg-error text-on-error'
            }`}
          >
            <MaterialIcon
              name={isDown ? 'trending_down' : 'trending_up'}
              size={14}
            />
            {Math.abs(trendPct).toFixed(1)}%
          </span>
          <span className="text-caption text-secondary/80">
            of {totalBookings} bookings
          </span>
        </div>
      </div>
    </div>
  )
}
