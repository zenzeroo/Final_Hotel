'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import Link from 'next/link'
import type { Customer } from '@/lib/data/types'
import { formatDate } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface CustomersAdminTableProps {
  customers: (Customer & { total_bookings: number })[]
  /** Current search query — pre-fills the search input. */
  currentQuery: string
  /** Current status filter — selects the right radio. */
  currentStatus: 'all' | 'active' | 'suspended'
}

/**
 * Customer list table with URL-driven search + status filter.
 *
 * Search: server-side filter via `?q=...` (Phase 36 decision — shareable
 * links, back/forward works). Input submits via form action that updates
 * URL params + reloads the server component.
 *
 * Status filter: radio buttons that immediately push to URL params
 * (preserves the existing `q` value).
 */
export function CustomersAdminTable({
  customers,
  currentQuery,
  currentStatus,
}: CustomersAdminTableProps) {
  const router = useRouter()
  const params = useSearchParams()

  const updateStatus = useCallback(
    (next: 'all' | 'active' | 'suspended') => {
      const sp = new URLSearchParams(params.toString())
      if (next === 'all') sp.delete('status')
      else sp.set('status', next)
      router.push(`/admin/customers?${sp.toString()}`)
    },
    [params, router],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search + filter bar */}
      <form
        action="/admin/customers"
        method="GET"
        className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
      >
        {currentStatus !== 'all' && (
          <input type="hidden" name="status" value={currentStatus} />
        )}
        <div className="relative flex-1">
          <MaterialIcon
            name="search"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
          />
          <input
            type="search"
            name="q"
            defaultValue={currentQuery}
            placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร..."
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-2 pl-10 pr-4 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-fixed hover:text-primary transition-colors"
        >
          <MaterialIcon name="search" size={18} />
          ค้นหา
        </button>
        {currentQuery && (
          <Link
            href="/admin/customers"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant text-on-surface rounded-lg hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            ล้าง
          </Link>
        )}
      </form>

      {/* Status filter radios */}
      <fieldset className="flex items-center gap-4 text-body-md">
        <legend className="sr-only">สถานะ</legend>
        <StatusRadio
          value="all"
          current={currentStatus}
          label="ทั้งหมด"
          onSelect={updateStatus}
        />
        <StatusRadio
          value="active"
          current={currentStatus}
          label="ใช้งาน"
          onSelect={updateStatus}
        />
        <StatusRadio
          value="suspended"
          current={currentStatus}
          label="ถูกระงับ"
          onSelect={updateStatus}
        />
      </fieldset>

      {/* Table */}
      {customers.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
          <MaterialIcon
            name="group"
            size={48}
            className="text-on-surface-variant mb-3"
          />
          <p className="text-body-lg text-on-surface-variant">
            ยังไม่มีลูกค้า
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
                  <th className="text-left px-4 py-3 font-medium">ลูกค้า</th>
                  <th className="text-left px-4 py-3 font-medium">อีเมล</th>
                  <th className="text-left px-4 py-3 font-medium">เบอร์โทร</th>
                  <th className="text-right px-4 py-3 font-medium">การจอง</th>
                  <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                  <th className="text-right px-4 py-3 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-primary-fixed transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="text-body-md font-medium text-primary hover:underline"
                      >
                        {c.full_name ?? '(ไม่มีชื่อ)'}
                      </Link>
                      <p className="text-caption text-on-surface-variant mt-0.5">
                        {formatDate(c.created_at, 'th-TH')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-body-md text-on-surface-variant">
                      {c.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-body-md text-on-surface-variant">
                      {c.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-body-md text-on-surface">
                      {c.total_bookings ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {c.is_suspended ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="block" size={12} />
                          ถูกระงับ
                        </span>
                      ) : c.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="check_circle" size={12} />
                          ใช้งาน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider font-semibold">
                          ปิด
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-md rounded-lg border border-outline-variant hover:bg-primary-fixed hover:text-primary transition-colors"
                      >
                        <MaterialIcon name="chevron_right" size={16} />
                        ดู
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusRadio({
  value,
  current,
  label,
  onSelect,
}: {
  value: 'all' | 'active' | 'suspended'
  current: 'all' | 'active' | 'suspended'
  label: string
  onSelect: (v: 'all' | 'active' | 'suspended') => void
}) {
  const active = value === current
  return (
    <label
      className={`inline-flex items-center gap-2 cursor-pointer select-none ${
        active ? 'text-primary font-semibold' : 'text-on-surface'
      }`}
    >
      <input
        type="radio"
        name="status"
        value={value}
        checked={active}
        onChange={() => onSelect(value)}
        className="accent-primary"
      />
      {label}
    </label>
  )
}
