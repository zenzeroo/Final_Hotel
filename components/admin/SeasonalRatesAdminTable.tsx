import Link from 'next/link'
import type { SeasonalRate } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { DeleteSeasonalRateButton } from '@/components/admin/DeleteSeasonalRateButton'

interface SeasonalRatesAdminTableProps {
  rates: SeasonalRate[]
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatPrice(r: SeasonalRate): string {
  if (r.flat_price != null) return `${r.flat_price.toLocaleString('th-TH')} THB`
  if (r.price_multiplier != null) return `×${r.price_multiplier.toFixed(2)}`
  return '—'
}

function isActiveNow(r: SeasonalRate): boolean {
  const now = Date.now()
  const start = new Date(r.start_date).getTime()
  const end = new Date(r.end_date).getTime()
  return r.is_active && start <= now && now <= end
}

function statusOf(r: SeasonalRate): 'current' | 'upcoming' | 'past' | 'inactive' {
  const now = Date.now()
  const start = new Date(r.start_date).getTime()
  const end = new Date(r.end_date).getTime()
  if (!r.is_active) return 'inactive'
  if (now > end) return 'past'
  if (now < start) return 'upcoming'
  return 'current'
}

const STATUS_LABEL: Record<ReturnType<typeof statusOf>, string> = {
  current: 'กำลังใช้งาน',
  upcoming: 'เร็วๆ นี้',
  past: 'หมดแล้ว',
  inactive: 'ปิดใช้งาน',
}

const STATUS_TONE: Record<ReturnType<typeof statusOf>, string> = {
  current: 'bg-secondary-container text-on-secondary-container',
  upcoming: 'bg-tertiary-container text-on-tertiary-container',
  past: 'bg-error-container text-on-error-container',
  inactive: 'bg-surface-container-high text-on-surface-variant',
}

export function SeasonalRatesAdminTable({ rates }: SeasonalRatesAdminTableProps) {
  if (rates.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon name="event" size={48} className="text-on-surface-variant mb-3" />
        <p className="text-body-lg text-on-surface-variant">ยังไม่มีช่วงราคาตามฤดูกาล</p>
      </div>
    )
  }

  const sorted = [...rates].sort((a, b) => {
    // active-now first, then by start_date desc
    const aCurrent = isActiveNow(a) ? 1 : 0
    const bCurrent = isActiveNow(b) ? 1 : 0
    if (aCurrent !== bCurrent) return bCurrent - aCurrent
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  })

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className="text-left px-4 py-3 font-medium">ชื่อช่วง</th>
              <th className="text-left px-4 py-3 font-medium">ประเภทห้อง</th>
              <th className="text-left px-4 py-3 font-medium">ช่วงวันที่</th>
              <th className="text-left px-4 py-3 font-medium">ราคา</th>
              <th className="text-left px-4 py-3 font-medium">ลำดับความสำคัญ</th>
              <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              <th className="text-right px-4 py-3 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {sorted.map((r) => {
              const status = statusOf(r)
              return (
                <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-4">
                    <p className="text-body-md font-medium text-primary">{r.label}</p>
                    {r.min_nights_override != null && (
                      <p className="text-caption text-on-surface-variant mt-0.5">
                        min {r.min_nights_override} คืน
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface">
                    {r.room_type_name ?? '—'}
                  </td>
                  <td className="px-4 py-4 text-caption text-on-surface-variant">
                    {formatDate(r.start_date)} – {formatDate(r.end_date)}
                  </td>
                  <td className="px-4 py-4 text-body-md text-primary font-semibold">
                    {formatPrice(r)}
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface-variant">
                    {r.priority}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold ${STATUS_TONE[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/admin/rates/seasonal-rates/${r.id}/edit`}
                        title="แก้ไข"
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <MaterialIcon name="edit" size={18} />
                      </Link>
                      <DeleteSeasonalRateButton id={r.id} label={r.label} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
