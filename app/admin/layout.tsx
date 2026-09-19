import { redirect } from 'next/navigation'
import { getSession, roleHomePath } from '@/lib/supabase/getSession'
import { StaffSidebar } from '@/components/layout/StaffSidebar'
import { StaffMobileHeader } from '@/components/layout/StaffMobileHeader'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login?next=/admin')
  if (session.role !== 'admin') redirect(roleHomePath(session.role))

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <StaffMobileHeader
        role="admin"
        userName={session.fullName}
        avatarKey={session.avatarKey}
      />
      <div className="flex flex-1 min-h-screen">
        <StaffSidebar
          role="admin"
          userName={session.fullName}
          avatarKey={session.avatarKey}
        />
        <main className="flex-1 bg-background min-h-screen overflow-x-auto">{children}</main>
      </div>
    </div>
  )
}
