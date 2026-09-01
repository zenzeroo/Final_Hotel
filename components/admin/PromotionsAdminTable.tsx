'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import type { Promotion } from '@/lib/data/types'
import { formatDiscount } from '@/lib/pricing'
import { TogglePromotionButton } from '@/components/manager/TogglePromotionButton'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { deletePromotionAction } from '@/app/actions/promotions'

interface PromotionsAdminTableProps {
  promotions: Promotion[]
  now: Date
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function isExpired(p: Promotion, now: Date): boolean {
  return new Date(p.valid_until).getTime() < now.getTime()
}

function isUpcoming(p: Promotion, now: Date): boolean {
  return new Date(p.valid_from).getTime() > now.getTime()
}

function DeleteButton({ id, code }: { id: string; code: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={(fd) => {
        if (!confirm(`ลบโปรโมชั่น "${code}"? การกระทำนี้ไม่สามารถยกเลิกได้`)) return
        startTransition(async () => {
          await deletePromotionAction(fd)
        })
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title={`ลบ ${code}`}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-error hover:bg-error-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="delete" size={18} />
      </button>
    </form>
  )
}

export function PromotionsAdminTable({ promotions, now }: PromotionsAdminTableProps) {
  if (promotions.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon name="local_offer" size={48} className="text-on-surface-variant mb-3" />
        <p className="text-body-lg text-on-surface-variant">ยังไม่มีโปรโมชั่น</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className="text-left px-4 py-3 font-medium">โค้ด</th>
              <th className="text-left px-4 py-3 font-medium">ชื่อ</th>
              <th className="text-left px-4 py-3 font-medium">ส่วนลด</th>
              <th className="text-left px-4 py-3 font-medium">คืนขั้นต่ำ</th>
              <th className="text-left px-4 py-3 font-medium">ช่วงเวลา</th>
              <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              <th className="text-right px-4 py-3 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {promotions.map((p) => {
              const expired = isExpired(p, now)
              const upcoming = isUpcoming(p, now)
              return (
                <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-4">
                    <span className="font-mono text-body-md font-bold text-primary bg-secondary-container px-2 py-1 rounded">
                      {p.code}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-body-md font-medium text-primary">{p.name}</p>
                    {p.description && (
                      <p className="text-caption text-on-surface-variant mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-body-md font-semibold text-secondary">
                      {formatDiscount(p)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface">
                    {p.min_nights} คืน
                  </td>
                  <td className="px-4 py-4 text-caption text-on-surface-variant">
                    {formatDate(p.valid_from)} – {formatDate(p.valid_until)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {expired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="schedule" size={12} />
                          หมดอายุ
                        </span>
                      )}
                      {upcoming && !expired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="event_upcoming" size={12} />
                          เร็วๆ นี้
                        </span>
                      )}
                      {!p.is_active && !expired && !upcoming && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="pause" size={12} />
                          ปิดใช้งาน
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <TogglePromotionButton promotionId={p.id} isActive={p.is_active} />
                      <Link
                        href={`/admin/promotions/${p.id}/edit`}
                        title="แก้ไข"
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <MaterialIcon name="edit" size={18} />
                      </Link>
                      <DeleteButton id={p.id} code={p.code} />
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
