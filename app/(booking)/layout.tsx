import { redirect } from 'next/navigation'
import { getSession, roleHomePath } from '@/lib/supabase/getSession'

/**
 * Layout for everything under /bookings/* (booking history, new booking
 * form, booking confirmation).
 *
 * Phase 11: staff must not reach /bookings/* — they have their own staff
 * portals (/reception, /housekeeper, /manager, /admin) for customer
 * service. Admin still goes through roleHomePath('admin') = '/admin'.
 *
 * Phase 53: the `!session → redirect('/login')` line was REMOVED. The
 * page itself (app/(booking)/bookings/page.tsx) now shows a styled
 * "please sign in" placeholder for logged-out visitors. The
 * /bookings/[id] and /bookings/new sub-routes still have their own
 * per-page guards (in the page file) because they act on a specific
 * booking id and need a session to load the row.
 */
export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (session && session.role !== 'user') redirect(roleHomePath(session.role))
  return <>{children}</>
}
