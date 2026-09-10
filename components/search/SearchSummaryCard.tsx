import { MaterialIcon } from '../ui/MaterialIcon'
import { formatDate } from '@/lib/dates'

interface SearchSummaryCardProps {
  checkin?: string
  checkout?: string
  guests?: number
}

export function SearchSummaryCard({ checkin, checkout, guests }: SearchSummaryCardProps) {
  const fmt = (iso?: string) => (iso ? formatDate(iso) : '—')

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
      <h3 className="font-display text-lg text-primary mb-4">การค้นหาของคุณ</h3>

      <dl className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <MaterialIcon name="calendar_today" size={20} className="text-primary mt-0.5" />
          <div className="flex-1">
            <dt className="text-caption text-on-surface-variant uppercase tracking-wider">เช็คอิน</dt>
            <dd className="text-body-md font-medium text-on-surface">{fmt(checkin)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MaterialIcon name="event" size={20} className="text-primary mt-0.5" />
          <div className="flex-1">
            <dt className="text-caption text-on-surface-variant uppercase tracking-wider">เช็คเอาท์</dt>
            <dd className="text-body-md font-medium text-on-surface">{fmt(checkout)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MaterialIcon name="group" size={20} className="text-primary mt-0.5" />
          <div className="flex-1">
            <dt className="text-caption text-on-surface-variant uppercase tracking-wider">ผู้เข้าพัก</dt>
            <dd className="text-body-md font-medium text-on-surface">{guests ?? '—'} ท่าน</dd>
          </div>
        </div>
      </dl>

      <button
        type="button"
        className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-primary text-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed transition-colors"
      >
        <MaterialIcon name="edit" size={16} />
        แก้ไขการค้นหา
      </button>
    </div>
  )
}
