import { redirect } from 'next/navigation'
import { getSession, roleHomePath } from '@/lib/supabase/getSession'

/**
 * User-only gate for everything under /bookings/* (booking history,
 * new booking form, booking confirmation). Phase 11 fix: staff must not
 * be able to reach /bookings/* — they have their own staff portals
 * (/reception, /housekeeper, /manager, /admin) for customer service.
 *
 * Admin still goes through roleHomePath('admin') = '/admin'.
 */
export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'user') redirect(roleHomePath(session.role))
  return <>{children}</>
}