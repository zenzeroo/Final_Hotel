import Link from 'next/link'
import type { StaffMember } from '@/lib/data/types'
import { formatDate } from '@/lib/dates'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AvatarBadge } from '@/components/account/AvatarBadge'

interface StaffTableProps {
  /** One page of staff (at most STAFF_PAGE_SIZE rows). */
  staff: StaffMember[]
  /** Shown inside the same box when there are no rows. */
  emptyText: string
  locale: Locale
}

/** Rows per page on /manager/staff. */
export const STAFF_PAGE_SIZE = 8
// Fixed row + header heights so the box is always as tall as a full page —
// a short last page, an empty search or the empty state never shrink it, and
// the shift grid below stays put. Cells don't wrap, so rows can't grow.
const ROW_PX = 72
const HEADER_PX = 48
const BOX_MIN_HEIGHT = HEADER_PX + STAFF_PAGE_SIZE * ROW_PX

const ROLE_LABEL: Record<StaffMember['role'], { key: string; icon: string }> = {
  manager: { key: 'manager.staffPage.roleManager', icon: 'admin_panel_settings' },
  reception: { key: 'manager.staffPage.roleReception', icon: 'support_agent' },
  housekeeper: { key: 'manager.staffPage.roleHousekeeper', icon: 'cleaning_services' },
  admin: { key: 'manager.staffPage.roleAdmin', icon: 'shield_person' },
}

export function StaffTable({ staff, emptyText, locale }: StaffTableProps) {
  const t = getT(locale)
  const localeBcp = locale === 'en' ? 'en-GB' : 'th-TH'
  if (staff.length === 0) {
    return (
      <div
        className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 flex flex-col items-center justify-center text-center"
        style={{ minHeight: BOX_MIN_HEIGHT }}
      >
        <MaterialIcon name="person_search" size={48} className="text-on-surface-variant mb-3" />
        <p className="text-body-lg text-on-surface-variant">{emptyText}</p>
      </div>
    )
  }
  return (
    <div
      className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden"
      style={{ minHeight: BOX_MIN_HEIGHT }}
    >
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant" style={{ height: HEADER_PX }}>
              <th className="text-left px-4 py-3 font-medium">{t('manager.staffPage.colStaff')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('manager.staffPage.colRole')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('manager.staffPage.colEmail')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('manager.staffPage.colHiredAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {staff.map((member) => {
              const role = ROLE_LABEL[member.role]
              return (
                <tr key={member.id} className="hover:bg-primary-fixed transition-colors" style={{ height: ROW_PX }}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <AvatarBadge avatarKey={member.avatar_key} fullName={member.full_name} size={40} />
                      {member.role === 'housekeeper' ? (
                        // Housekeepers have a workload/task detail page.
                        <Link
                          href={`/manager/housekeeping/staff/${member.id}`}
                          className="text-body-md font-medium text-primary hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                        >
                          {member.full_name}
                        </Link>
                      ) : (
                        <span className="text-body-md font-medium text-primary">{member.full_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2 text-body-md text-on-surface">
                      <MaterialIcon name={role.icon} size={16} className="text-on-surface-variant" />
                      {t(role.key)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-body-md text-on-surface-variant">
                    {member.email}
                  </td>
                  <td className="px-4 py-2 text-body-md text-on-surface-variant">
                    {formatDate(member.hired_at, localeBcp)}
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
