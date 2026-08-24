'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import type { StaffMember } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { setStaffActiveAction } from '@/app/actions/admin/staff'

interface StaffAdminTableProps {
  staff: StaffMember[]
  currentUserId: string
}

const ROLE_LABEL: Record<StaffMember['role'], string> = {
  reception: 'พนักงานต้อนรับ',
  housekeeper: 'พนักงานทำความสะอาด',
  manager: 'ผู้จัดการ',
  admin: 'ผู้ดูแลระบบ',
}

const ROLE_BADGE_CLASS: Record<StaffMember['role'], string> = {
  reception: 'bg-tertiary-container text-on-tertiary-container',
  housekeeper: 'bg-primary-container text-on-primary-container',
  manager: 'bg-secondary-container text-on-secondary-container',
  admin: 'bg-error-container text-on-error-container',
}

function ToggleActiveButton({
  id,
  isActive,
  isSelf,
}: {
  id: string
  isActive: boolean
  isSelf: boolean
}) {
  const [pending, startTransition] = useTransition()
  const label = isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'
  const icon = isActive ? 'block' : 'check_circle'
  const disabled = isSelf || pending

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await setStaffActiveAction(fd)
        })
      }}
      className="inline"
    >
      <input type="hidden" name="staffId" value={id} />
      <input type="hidden" name="isActive" value={(!isActive).toString()} />
      <button
        type="submit"
        disabled={disabled}
        title={isSelf ? 'ไม่สามารถปิดใช้งานบัญชีตัวเองได้' : label}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-md rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <MaterialIcon name={icon} size={16} />
        {pending ? '...' : label}
      </button>
    </form>
  )
}

function initials(fullName: string): string {
  return fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function StaffAdminTable({ staff, currentUserId }: StaffAdminTableProps) {
  if (staff.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon name="badge" size={48} className="text-on-surface-variant mb-3" />
        <p className="text-body-lg text-on-surface-variant">ยังไม่มีพนักงาน</p>
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
              <th className="text-left px-4 py-3 font-medium">อีเมล</th>
              <th className="text-left px-4 py-3 font-medium">บทบาท</th>
              <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              <th className="text-right px-4 py-3 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {staff.map((s) => {
              const isSelf = s.id === currentUserId
              return (
                <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary text-secondary inline-flex items-center justify-center font-semibold text-body-md shrink-0">
                        {initials(s.full_name)}
                      </div>
                      <div>
                        <p className="text-body-md font-medium text-primary">
                          {s.full_name}
                          {isSelf && (
                            <span className="ml-2 text-caption text-on-surface-variant">(คุณ)</span>
                          )}
                        </p>
                        {s.phone && (
                          <p className="text-caption text-on-surface-variant">{s.phone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface-variant">{s.email}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider font-semibold ${ROLE_BADGE_CLASS[s.role]}`}
                    >
                      {ROLE_LABEL[s.role]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {s.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-semibold">
                        <MaterialIcon name="check_circle" size={12} />
                        ใช้งาน
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider font-semibold">
                        <MaterialIcon name="block" size={12} />
                        ปิดใช้งาน
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/staff/${s.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-md rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors"
                      >
                        <MaterialIcon name="edit" size={16} />
                        แก้ไข
                      </Link>
                      <ToggleActiveButton id={s.id} isActive={s.is_active} isSelf={isSelf} />
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
