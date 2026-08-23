import type { RoomUnitWithType, RoomUnitStatus } from '@/lib/data/types'
import { CloseRoomButton } from './CloseRoomButton'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface RoomInventoryTableProps {
  units: RoomUnitWithType[]
}

const STATUS_LABEL: Record<RoomUnitStatus, { th: string; icon: string; chip: string; dot: string }> = {
  available: {
    th: 'ว่าง',
    icon: 'check_circle',
    chip: 'bg-primary-container text-on-primary-container',
    dot: 'bg-primary',
  },
  occupied: {
    th: 'มีแขก',
    icon: 'person',
    chip: 'bg-tertiary-container text-on-tertiary-container',
    dot: 'bg-tertiary',
  },
  cleaning: {
    th: 'กำลังทำความสะอาด',
    icon: 'cleaning_services',
    chip: 'bg-secondary-container text-on-secondary-container',
    dot: 'bg-secondary',
  },
  maintenance: {
    th: 'ปิดซ่อมบำรุง',
    icon: 'build',
    chip: 'bg-error-container text-on-error-container',
    dot: 'bg-error',
  },
  out_of_order: {
    th: 'ปิดใช้งาน',
    icon: 'block',
    chip: 'bg-surface-container-high text-on-surface-variant',
    dot: 'bg-on-surface-variant',
  },
}

function formatTHB(value: number): string {
  return value.toLocaleString('th-TH')
}

export function RoomInventoryTable({ units }: RoomInventoryTableProps) {
  // Group by floor
  const floors = Array.from(new Set(units.map((u) => u.floor))).sort((a, b) => a - b)
  const grouped = floors.map((floor) => ({
    floor,
    units: units.filter((u) => u.floor === floor),
  }))

  return (
    <div className="space-y-6">
      {grouped.map(({ floor, units: floorUnits }) => (
        <section key={floor}>
          <h3 className="font-headline-xs text-headline-xs text-primary mb-3">
            ชั้น {floor}{' '}
            <span className="text-caption text-on-surface-variant ml-2">
              ({floorUnits.length} ห้อง)
            </span>
          </h3>
          <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
                  <th className="text-left px-4 py-3 font-medium">ห้อง</th>
                  <th className="text-left px-4 py-3 font-medium">ประเภท</th>
                  <th className="text-left px-4 py-3 font-medium">วิว</th>
                  <th className="text-right px-4 py-3 font-medium">ราคา/คืน</th>
                  <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                  <th className="text-right px-4 py-3 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {floorUnits.map((unit) => {
                  const status = STATUS_LABEL[unit.status]
                  const isClosed =
                    unit.status === 'maintenance' || unit.status === 'out_of_order'
                  return (
                    <tr key={unit.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-mono text-body-md font-bold text-primary">
                          {unit.unit_label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-body-md font-medium text-primary">
                          {unit.room_type.name}
                        </p>
                        {unit.room_type.name_th && (
                          <p className="text-caption text-on-surface-variant">
                            {unit.room_type.name_th}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-body-md text-on-surface-variant">
                        {unit.view_label ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-body-md font-semibold text-primary">
                          {formatTHB(unit.room_type.base_price)}
                        </span>{' '}
                        <span className="text-caption text-on-surface-variant">THB</span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold ${status.chip}`}
                        >
                          <MaterialIcon name={status.icon} size={12} />
                          {status.th}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <CloseRoomButton unitId={unit.id} isClosed={isClosed} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
