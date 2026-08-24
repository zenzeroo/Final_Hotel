import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const { data: promos } = await supabase.from('promotions').select('id, code, name, is_active').limit(10)
console.log('promotions:', JSON.stringify(promos, null, 2))

const { data: units } = await supabase.from('room_units').select('id, floor, unit_label, status').order('floor').limit(15)
console.log('units:', JSON.stringify(units, null, 2))
