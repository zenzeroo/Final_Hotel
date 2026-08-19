import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/supabase/getSession'
import { StaffSidebar } from '@/components/layout/StaffSidebar'

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) {
    redirect('/login?next=/reception')
  }
  if (session.role !== 'reception' && session.role !== 'admin') {
    redirect('/')
  }

  // Read pathname from headers (set by middleware/Next.js)
  const headerList = await headers()
  const pathname = headerList.get('x-invoke-path') ?? '/reception'

  return (
    <div className="min-h-screen flex">
      <StaffSidebar role="reception" userName={session.fullName} pathname={pathname} />
      <main className="flex-1 bg-background min-h-screen overflow-x-auto">{children}</main>
    </div>
  )
}
