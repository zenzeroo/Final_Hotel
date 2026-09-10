import type { StaffMember, ShiftSlot } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatDate } from '@/lib/dates'

interface ShiftScheduleProps {
  staff: StaffMember[]
  shifts: ShiftSlot[]
}

const POSITION_LABEL: Record<ShiftSlot['position'], { th: string; icon: string; tone: string }> = {
  morning: { th: 'เช้า', icon: 'wb_sunny', tone: 'bg-secondary-container text-on-secondary-container' },
  afternoon: { th: 'บ่าย', icon: 'wb_cloudy', tone: 'bg-primary-container text-on-primary-container' },
  evening: { th: 'เย็น', icon: 'nightlight', tone: 'bg-tertiary-container text-on-tertiary-container' },
  off: { th: 'พัก', icon: 'do_not_disturb_on', tone: 'bg-surface-container-high text-on-surface-variant' },
}

function formatDayHeader(dateStr: string): { weekday: string; day: string } {
  return {
    weekday: new Intl.DateTimeFormat('th-TH', { weekday: 'short', calendar: 'gregory' }).format(new Date(dateStr)),
    day: formatDate(dateStr),
  }
}

export function ShiftSchedule({ staff, shifts }: ShiftScheduleProps) {
  // Empty branch — guard against silent empty-table on no-staff / no-shifts DB.
  if (staff.length === 0) {
    return (
      <EmptyState
        icon="event"
        title="ยังไม่มีตารางเวร"
        description="ต้องมีพนักงานในระบบและตารางเวรถึงจะแสดงได้"
      />
    )
  }

  // Build unique date list (sorted)
  const dates = Array.from(new Set(shifts.map((s) => s.date))).sort()
  const slotsByKey = new Map<string, ShiftSlot>()
  for (const slot of shifts) {
    slotsByKey.set(`${slot.staffId}__${slot.date}`, slot)
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface-container-low px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium border-b border-r border-outline-variant">
              พนักงาน
            </th>
            {dates.map((d) => {
              const head = formatDayHeader(d)
              return (
                <th
                  key={d}
                  className="px-3 py-3 text-center text-label-md uppercase tracking-wider text-on-surface-variant font-medium border-b border-outline-variant"
                >
                  <div>{head.weekday}</div>
                  <div className="text-caption normal-case text-primary font-semibold mt-1">
                    {head.day}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id} className="border-b border-outline-variant last:border-b-0">
              <td className="sticky left-0 z-10 bg-surface-container-lowest px-4 py-3 text-body-md font-medium text-primary border-r border-outline-variant">
                {member.full_name}
              </td>
              {dates.map((d) => {
                const slot = slotsByKey.get(`${member.id}__${d}`)
                const pos = slot ? POSITION_LABEL[slot.position] : null
                return (
                  <td key={d} className="px-2 py-3 text-center">
                    {pos ? (
                      <span
                        title={`${pos.th} (${d})`}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${pos.tone}`}
                      >
                        <MaterialIcon name={pos.icon} size={14} />
                      </span>
                    ) : (
                      <span className="text-on-surface-variant text-caption">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
