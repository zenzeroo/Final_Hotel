import { listStaff } from '@/lib/data/manager'
import { getSession } from '@/lib/supabase/getSession'
import { StaffAdminTable } from '@/components/admin/StaffAdminTable'
import { AddStaffModal } from '@/components/admin/AddStaffModal'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function AdminStaffPage() {
  const session = await getSession()
  const staff = await listStaff()

  const activeCount = staff.filter((s) => s.is_active).length
  const adminCount = staff.filter((s) => s.role === 'admin' && s.is_active).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">จัดการเจ้าหน้าที่</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            จัดการพนักงานทั้งหมด — เพิ่ม / แก้ไข / เปิด-ปิดการใช้งาน
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Phase 33 — Add staff modal trigger (replaces inline AddStaffForm section) */}
          <AddStaffModal />
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <MaterialIcon name="badge" size={18} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">{staff.length} คน</span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            พนักงานทั้งหมด
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{staff.length}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ใช้งานอยู่
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{activeCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ผู้ดูแลระบบ
          </p>
          <p className="font-display-lg text-display-lg-mobile text-error">{adminCount}</p>
        </div>
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">พนักงานทั้งหมด</h2>
        <StaffAdminTable staff={staff} currentUserId={session?.id ?? ''} />
      </section>
    </div>
  )
}
