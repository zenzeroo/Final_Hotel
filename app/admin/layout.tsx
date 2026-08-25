import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession, roleHomePath } from '@/lib/supabase/getSession'
import { StaffSidebar } from '@/components/layout/StaffSidebar'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login?next=/admin')
  if (session.role !== 'admin') redirect(roleHomePath(session.role))

  const headerList = await headers()
  const pathname = headerList.get('x-invoke-path') ?? '/admin'

  return (
    <div className="min-h-screen flex">
      <StaffSidebar role="admin" userName={session.fullName} pathname={pathname} />
      <main className="flex-1 bg-background min-h-screen overflow-x-auto">{children}</main>
    </div>
  )
}
