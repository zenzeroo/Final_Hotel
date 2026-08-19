import { createClient } from '@/lib/supabase/server'

/**
 * Fetch a room_type by ID (not slug). Used by the booking flow.
 */
export async function getRoomById(roomId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('id', roomId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return null
  return data
}
