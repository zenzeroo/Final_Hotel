import { listStaff, listShifts } from '@/lib/data/manager'
import { StaffTable } from '@/components/manager/StaffTable'
import { ShiftSchedule } from '@/components/manager/ShiftSchedule'
import { StaffTabs } from '@/components/manager/StaffTabs'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

type Tab = 'all' | 'manager' | 'reception' | 'housekeeper'

export default async function ManagerStaffPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const searchParams = await props.searchParams
  const allowed: Tab[] = ['all', 'manager', 'reception', 'housekeeper']
  const raw = (searchParams.tab as Tab) ?? 'all'
  const tab: Tab = allowed.includes(raw) ? raw : 'all'

  const [staff, shifts] = await Promise.all([listStaff(), listShifts()])

  const filteredStaff =
    tab === 'all' ? staff : staff.filter((s) => s.role === tab)

  const activeCount = staff.filter((s) => s.is_active).length
  const receptionCount = staff.filter((s) => s.role === 'reception').length
  const housekeeperCount = staff.filter((s) => s.role === 'housekeeper').length
  const onShiftToday = shifts.filter(
    (slot) => slot.date === new Date().toISOString().slice(0, 10) && slot.position !== 'off',
  ).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">จัดการเจ้าหน้าที่</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            รายชื่อพนักงานและตารางเวร 7 วัน — การแก้ไขทำได้ผ่าน Admin
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
          <MaterialIcon name="group" size={18} className="text-on-surface-variant" />
          <span className="text-body-md text-on-surface-variant">
            {staff.length} คน
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            พนักงานทั้งหมด
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{staff.length}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            กำลังทำงาน
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{activeCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            เข้าเวรวันนี้
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{onShiftToday}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ต้อนรับ / แม่บ้าน
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {receptionCount} / {housekeeperCount}
          </p>
        </div>
      </section>

      <StaffTabs active={tab} />

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          รายชื่อพนักงาน{tab === 'all' ? '' : ` — ${tabName(tab)}`}
        </h2>
        <StaffTable staff={filteredStaff} />
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          ตารางเวร 7 วัน
        </h2>
        <ShiftSchedule staff={staff} shifts={shifts} />
      </section>
    </div>
  )
}

function tabName(t: Tab): string {
  switch (t) {
    case 'manager':
      return 'ผู้จัดการ'
    case 'reception':
      return 'ต้อนรับ'
    case 'housekeeper':
      return 'แม่บ้าน'
    default:
      return ''
  }
}
