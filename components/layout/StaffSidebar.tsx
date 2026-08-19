import Link from 'next/link'
import { MaterialIcon } from '../ui/MaterialIcon'
import { signOut } from '@/app/actions/auth'
import { formatTHB } from '@/lib/pricing'

interface StaffSidebarProps {
  role: 'reception' | 'housekeeper' | 'admin'
  userName: string | null
  pathname: string
}

interface NavItem {
  label: string
  href: string
  icon: string
}

const RECEPTION_NAV: NavItem[] = [
  { label: 'แดชบอร์ด', href: '/reception', icon: 'dashboard' },
  { label: 'จัดการการจอง', href: '/reception/bookings', icon: 'bookmark' },
  { label: 'Walk-in Booking', href: '/reception/bookings/new', icon: 'person_add' },
  { label: 'เช็คอิน / เช็คเอาท์', href: '/reception/check-in-out', icon: 'swap_horiz' },
  { label: 'ค้นหาลูกค้า', href: '/reception/customers', icon: 'search' },
  { label: 'คำขอจากแขก', href: '/reception/requests', icon: 'forum' },
  { label: 'สถานะห้องพัก', href: '/reception/rooms', icon: 'hotel' },
  { label: 'ประวัติการดำเนินการ', href: '/reception/history', icon: 'history' },
]

const HOUSEKEEPER_NAV: NavItem[] = [
  { label: 'แดชบอร์ด', href: '/housekeeper', icon: 'dashboard' },
  { label: 'ภาพรวมห้องพัก', href: '/housekeeper/rooms', icon: 'hotel' },
  { label: 'งานของฉัน', href: '/housekeeper/tasks', icon: 'task_alt' },
  { label: 'ประวัติการทำงาน', href: '/housekeeper/history', icon: 'history' },
  { label: 'รายงานการซ่อมบำรุง', href: '/housekeeper/maintenance', icon: 'build' },
]

const ROLE_LABEL = {
  reception: 'พนักงานต้อนรับ',
  housekeeper: 'พนักงานทำความสะอาด',
  admin: 'ผู้ดูแลระบบ',
} as const

export function StaffSidebar({ role, userName, pathname }: StaffSidebarProps) {
  const navItems = role === 'housekeeper' ? HOUSEKEEPER_NAV : RECEPTION_NAV

  return (
    <aside className="w-72 shrink-0 bg-primary text-secondary min-h-screen flex flex-col">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-primary-container">
        <Link href="/" className="font-display text-2xl font-bold text-secondary">
          Zenzero Hotel
        </Link>
        <p className="text-caption text-secondary/70 mt-1 uppercase tracking-wider">
          {ROLE_LABEL[role]}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== `/${role}` && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-container text-secondary font-semibold'
                  : 'text-secondary/80 hover:bg-primary-container/50 hover:text-secondary'
              }`}
            >
              <MaterialIcon name={item.icon} size={20} filled={isActive} />
              <span className="text-body-md">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-primary-container">
        <div className="px-3 py-2 mb-2">
          <p className="text-caption text-secondary/70 uppercase tracking-wider">ผู้ใช้งาน</p>
          <p className="text-body-md font-medium truncate">{userName ?? '—'}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full inline-flex items-center gap-3 px-3 py-2.5 rounded-lg text-secondary/80 hover:bg-primary-container/50 hover:text-secondary transition-colors"
          >
            <MaterialIcon name="logout" size={20} />
            <span className="text-body-md">ออกจากระบบ</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
