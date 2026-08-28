'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { reportMaintenance } from '@/app/actions/housekeeping'
import type { RoomUnitBasic, MaintenanceIssueType, MaintenanceSeverity } from '@/lib/data/types'

const ISSUE_TYPES: { value: MaintenanceIssueType; label: string }[] = [
  { value: 'plumbing', label: 'ประปา' },
  { value: 'electrical', label: 'ไฟฟ้า' },
  { value: 'hvac', label: 'แอร์/เครื่องปรับอากาศ' },
  { value: 'furniture', label: 'เฟอร์นิเจอร์' },
  { value: 'appliance', label: 'เครื่องใช้ไฟฟ้า' },
  { value: 'other', label: 'อื่นๆ' },
]

const SEVERITIES: { value: MaintenanceSeverity; label: string }[] = [
  { value: 'low', label: 'ต่ำ' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'high', label: 'สูง' },
  { value: 'critical', label: 'วิกฤต (ห้องถูกตั้งสถานะปิด)' },
]

export function MaintenanceReportModal({ roomUnits }: { roomUnits: RoomUnitBasic[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await reportMaintenance({
        room_unit_id: form.get('room_unit_id') as string,
        issue_type: form.get('issue_type') as MaintenanceIssueType,
        severity: form.get('severity') as MaintenanceSeverity,
        title: form.get('title') as string,
        description: (form.get('description') as string) || undefined,
      })
      if (result.ok) {
        setIsOpen(false)
        e.currentTarget?.reset()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-secondary rounded-md text-caption uppercase tracking-wider hover:bg-primary-container transition-colors"
      >
        <MaterialIcon name="build" size={18} />
        รายงานใหม่
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-level-2 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-sm text-headline-sm text-primary">แจ้งปัญหาการซ่อมบำรุง</h2>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-surface-container">
                <MaterialIcon name="close" size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">ห้อง</label>
                <select name="room_unit_id" required className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
                  <option value="">เลือกห้อง...</option>
                  {roomUnits.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.floor}·{u.unit_label} — {u.room_type?.name ?? 'ห้อง'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">ประเภทปัญหา</label>
                <select name="issue_type" required className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
                  {ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">ความรุนแรง</label>
                <select name="severity" required defaultValue="medium" className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
                  {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">หัวข้อ</label>
                <input name="title" required maxLength={100} className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="สรุปสั้นๆ" />
              </div>
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">คำอธิบาย (ไม่บังคับ)</label>
                <textarea name="description" rows={3} className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary" />
              </div>
              {error && <p className="text-body-md text-error">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsOpen(false)} className="flex-1 px-4 py-2 border border-outline-variant rounded-md text-body-md text-primary hover:bg-surface-container">ยกเลิก</button>
                <button type="submit" disabled={isPending} className="flex-1 px-4 py-2 bg-primary text-secondary rounded-md text-caption uppercase tracking-wider hover:bg-primary-container disabled:opacity-50">
                  {isPending ? 'กำลังส่ง...' : 'ส่ง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}