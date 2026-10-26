import { redirect } from 'next/navigation'
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <StaffMobileHeader
        role="reception"
        userName={session.fullName}
        avatarKey={session.avatarKey}
          userId={session.id}
      />
      <div className="flex flex-1 min-h-screen">
        <StaffSidebar
          role="reception"
          userName={session.fullName}
          avatarKey={session.avatarKey}
          userId={session.id}
        />
        {/* overflow-x-clip, not -auto: -auto makes <main> its own scroll
            container, which breaks position:sticky (booking-detail actions).
            min-w-0: unlike -auto, -clip doesn't let a flex item shrink below
            its content, so without it wide content (e.g. the scrolling
            filter tabs) stretches the page past the screen on phones. */}
        <main className="flex-1 min-w-0 bg-background min-h-screen overflow-x-clip">{children}</main>
      </div>
    </div>
  )
}
