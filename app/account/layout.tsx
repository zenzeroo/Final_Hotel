import { redirect } from 'next/navigation'
import { getSession, roleHomePath } from '@/lib/supabase/getSession'

/**
 * Thin auth gate for the ( /account) route group.
 *
 * Clones `app/(booking)/layout.tsx` but gates to `role === 'user'` only
 * (staff get redirected to their own dashboard via `roleHomePath`).
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login?next=/account/profile')
  if (session.role !== 'user') redirect(roleHomePath(session.role))
  return <>{children}</>
}