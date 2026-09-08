import type { StaffMember } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface StaffTableProps {
  staff: StaffMember[]
}

const ROLE_LABEL: Record<StaffMember['role'], { th: string; icon: string; tone: string }> = {
  manager: { th: 'ผู้จัดการ', icon: 'admin_panel_settings', tone: 'bg-tertiary text-secondary' },
  reception: { th: 'พนักงานต้อนรับ', icon: 'support_agent', tone: 'bg-primary text-secondary' },
  housekeeper: { th: 'พนักงานทำความสะอาด', icon: 'cleaning_services', tone: 'bg-secondary text-on-secondary' },
  admin: { th: 'ผู้ดูแลระบบ', icon: 'shield_person', tone: 'bg-error text-on-error' },
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function StaffTable({ staff }: StaffTableProps) {
  if (staff.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon name="group" size={48} className="text-on-surface-variant mb-3" />
        <p className="text-body-lg text-on-surface-variant">ไม่มีพนักงานในกลุ่มนี้</p>
      </div>
    )
  }
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className="text-left px-4 py-3 font-medium">พนักงาน</th>
              <th className="text-left px-4 py-3 font-medium">ตำแหน่ง</th>
              <th className="text-left px-4 py-3 font-medium">อีเมล</th>
              <th className="text-left px-4 py-3 font-medium">วันที่เริ่มงาน</th>
              <th className="text-left px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {staff.map((member) => {
              const role = ROLE_LABEL[member.role]
              return (
                <tr key={member.id} className="hover:bg-primary-fixed transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${role.tone} font-semibold text-caption`}
                      >
                        {initials(member.full_name)}
                      </span>
                      <span className="text-body-md font-medium text-primary">
                        {member.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-2 text-body-md text-on-surface">
                      <MaterialIcon name={role.icon} size={16} className="text-on-surface-variant" />
                      {role.th}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface-variant">
                    {member.email}
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface-variant">
                    {new Date(member.hired_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold ${
                        member.is_active
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <MaterialIcon
                        name={member.is_active ? 'check_circle' : 'block'}
                        size={12}
                      />
                      {member.is_active ? 'ทำงานอยู่' : 'พ้นสภาพ'}
                    </span>
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
