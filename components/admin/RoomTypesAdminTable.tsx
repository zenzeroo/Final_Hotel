import Link from 'next/link'
import type { RoomType } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface RoomTypesAdminTableProps {
  roomTypes: RoomType[]
}

export function RoomTypesAdminTable({ roomTypes }: RoomTypesAdminTableProps) {
  if (roomTypes.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon name="bed" size={48} className="text-on-surface-variant mb-3" />
        <p className="text-body-lg text-on-surface-variant">ยังไม่มีประเภทห้อง</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className="text-left px-4 py-3 font-medium">ประเภทห้อง</th>
              <th className="text-left px-4 py-3 font-medium">Slug (URL)</th>
              <th className="text-right px-4 py-3 font-medium">ราคาฐาน</th>
              <th className="text-right px-4 py-3 font-medium">ผู้เข้าพัก</th>
              <th className="text-right px-4 py-3 font-medium">ขนาด</th>
              <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              <th className="text-right px-4 py-3 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {roomTypes.map((r) => (
              <tr key={r.id} className="hover:bg-primary-fixed transition-colors">
                <td className="px-4 py-4">
                  <p className="text-body-md font-medium text-primary">{r.name}</p>
                  <p className="text-caption text-on-surface-variant">{r.name_th}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-body-sm text-on-surface-variant">{r.slug}</span>
                </td>
                <td className="px-4 py-4 text-right text-body-md text-primary font-semibold">
                  {formatTHB(r.base_price)}
                </td>
                <td className="px-4 py-4 text-right text-body-md text-on-surface">
                  {r.max_guests} คน
                </td>
                <td className="px-4 py-4 text-right text-body-md text-on-surface">
                  {r.size_sqm} ตร.ม.
                </td>
                <td className="px-4 py-4">
                  {r.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-semibold">
                      <MaterialIcon name="check_circle" size={12} />
                      เปิด
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider font-semibold">
                      <MaterialIcon name="block" size={12} />
                      ปิด
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={`/admin/rates/room-types/${r.id}/edit`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-md rounded-lg border border-outline-variant hover:bg-primary-fixed hover:text-primary transition-colors"
                  >
                    <MaterialIcon name="edit" size={16} />
                    แก้ไข
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
