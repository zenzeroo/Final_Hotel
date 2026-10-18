'use client'

/** Reports — top-N ranking (most-booked rooms, highest-revenue room types). */
import { EmptyState } from '@/components/feedback/EmptyState'
import { BarChart, type BarFormat } from './BarChart'
import { useT } from '@/lib/i18n/useT'

interface RankedBarChartProps {
  title: string
  labels: string[]
  values: number[]
  format: BarFormat
  label: string
  emptyDescription?: string
}

export function RankedBarChart({ title, labels, values, format, label, emptyDescription }: RankedBarChartProps) {
  const t = useT()
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">{title}</h3>
      {/* Empty branch — getReportsData returns [] when there are no bookings
          in the analysis window. */}
      {labels.length === 0 ? (
        <EmptyState
          icon="bar_chart"
          title={t('manager.reportsPage.noData')}
          description={emptyDescription ?? t('manager.reportsPage.noDataBody')}
        />
      ) : (
        <BarChart
          labels={labels}
          datasets={[{ label, values }]}
          format={format}
          countUnit={t('manager.reportsPage.bookingsUnit')}
          ariaLabel={title}
        />
      )}
    </div>
  )
}
