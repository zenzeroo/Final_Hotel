import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/require'
import { getOwnProfile } from '@/lib/data/supabase-account'
import { AccountProfileContent } from '@/components/account/AccountProfileContent'

export const dynamic = 'force-dynamic'

export default async function ReceptionProfilePage() {
  await requireRole('reception', '/reception/profile')
  const profile = await getOwnProfile()
  if (!profile) notFound()

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          โปรไฟล์ของฉัน
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          จัดการข้อมูลส่วนตัวและรหัสผ่าน
        </p>
      </header>
      <AccountProfileContent
        profile={profile}
        showDangerZone={false}
        quickLinks={[
          { href: '/reception', icon: 'dashboard', label: 'แดชบอร์ด' },
          { href: '/reception/bookings', icon: 'bookmark', label: 'การจอง' },
        ]}
      />
    </div>
  )
}
