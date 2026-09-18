import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession, roleHomePath } from '@/lib/supabase/getSession'
import { StaffSidebar } from '@/components/layout/StaffSidebar'
import { StaffMobileHeader } from '@/components/layout/StaffMobileHeader'

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) {
    redirect('/login?next=/reception')
  }
  if (session.role !== 'reception' && session.role !== 'admin') {
    redirect(roleHomePath(session.role))
  }

  // Read pathname from headers (set by middleware/Next.js)
  const headerList = await headers()
  const pathname = headerList.get('x-invoke-path') ?? '/reception'

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <StaffMobileHeader role="reception" userName={session.fullName} pathname={pathname} />
      <div className="flex flex-1 min-h-screen">
        <StaffSidebar role="reception" userName={session.fullName} pathname={pathname} />
        <main className="flex-1 bg-background min-h-screen overflow-x-auto">{children}</main>
      </div>
    </div>
  )
}
