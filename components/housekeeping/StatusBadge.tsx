import type { HousekeepingTaskStatus, MaintenanceStatus, RoomUnitStatus } from '@/lib/data/types'

type AnyStatus = HousekeepingTaskStatus | MaintenanceStatus | RoomUnitStatus

const STYLES: Record<AnyStatus, { bg: string; text: string; label: string }> = {
  unassigned: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'ยังไม่ได้มอบหมาย' },
  assigned: { bg: 'bg-secondary/10', text: 'text-secondary', label: 'มอบหมายแล้ว' },
  in_progress: { bg: 'bg-secondary/30', text: 'text-on-secondary-container', label: 'กำลังดำเนินการ' },
  completed: { bg: 'bg-primary-container', text: 'text-on-primary-container', label: 'เสร็จสิ้น' },
  cancelled: { bg: 'bg-surface-container', text: 'text-on-surface-variant', label: 'ยกเลิก' },
  open: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'เปิดอยู่' },
  resolved: { bg: 'bg-primary-container', text: 'text-on-primary-container', label: 'แก้ไขแล้ว' },
  available: { bg: 'bg-primary-container', text: 'text-on-primary-container', label: 'ว่าง' },
  occupied: { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', label: 'มีแขก' },
  cleaning: { bg: 'bg-secondary/30', text: 'text-on-secondary-container', label: 'กำลังทำความสะอาด' },
  maintenance: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'ปิดซ่อมบำรุง' },
  out_of_order: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'ปิดใช้งาน' },
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const s = STYLES[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}