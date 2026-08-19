import { getRecentEvents } from '@/lib/data/staff'
import { formatDateTime } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

const EVENT_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  created: { label: 'สร้างการจอง', color: 'bg-primary/10 text-primary', icon: 'add_circle' },
  confirmed: { label: 'ยืนยัน', color: 'bg-primary/10 text-primary', icon: 'verified' },
  checked_in: { label: 'เช็คอิน', color: 'bg-secondary/20 text-secondary', icon: 'login' },
  checked_out: { label: 'เช็คเอาท์', color: 'bg-surface-container text-on-surface-variant', icon: 'logout' },
  cancelled: { label: 'ยกเลิก', color: 'bg-error/10 text-error', icon: 'cancel' },
  paid: { label: 'ชำระเงิน', color: 'bg-primary/10 text-primary', icon: 'credit_card' },
  note_added: { label: 'เพิ่มบันทึก', color: 'bg-surface-container text-on-surface-variant', icon: 'note_add' },
  status_changed: { label: 'เปลี่ยนสถานะ', color: 'bg-surface-container text-on-surface-variant', icon: 'sync' },
}

const ROLE_LABEL: Record<string, string> = {
  user: 'ลูกค้า',
  reception: 'พนักงานต้อนรับ',
  housekeeper: 'พนักงานทำความสะอาด',
  admin: 'ผู้ดูแล',
}

export default async function ActionHistoryPage() {
  const events = await getRecentEvents(50)

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">ประวัติการดำเนินการ</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          บันทึกกิจกรรมล่าสุดในระบบ · {events.length} รายการ
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="history" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">ยังไม่มีประวัติการดำเนินการ</p>
          <p className="text-caption text-on-surface-variant mt-1">
            เมื่อมีการจอง/เช็คอิน/เช็คเอาท์/ยกเลิก จะแสดงที่นี่
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-hidden">
          <ul className="divide-y divide-outline-variant">
            {events.map((e: any) => {
              const meta = EVENT_TYPE_META[e.event_type] ?? {
                label: e.event_type,
                color: 'bg-surface-container text-on-surface-variant',
                icon: 'event',
              }
              return (
                <li key={e.id} className="px-5 py-4 flex items-start gap-3 hover:bg-surface-container-low transition-colors">
                  <div className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${meta.color}`}>
                    <MaterialIcon name={meta.icon} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-caption text-on-surface-variant">
                        {formatDateTime(e.created_at)}
                      </span>
                    </div>
                    <p className="text-body-md text-on-surface mt-1">{e.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-caption text-on-surface-variant">
                      {e.actor && (
                        <span className="inline-flex items-center gap-1.5">
                          <MaterialIcon name="person" size={14} />
                          {e.actor.full_name} · {ROLE_LABEL[e.actor.role] ?? e.actor.role}
                        </span>
                      )}
                      {e.booking_id && (
                        <span className="inline-flex items-center gap-1.5 font-mono">
                          <MaterialIcon name="bookmark" size={14} />
                          booking/{e.booking_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
