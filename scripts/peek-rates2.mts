import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const cookies: any[] = []
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll: () => cookies.map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => { for (const { name, value, options } of toSet) cookies.push({ name, value, opts: options }) },
    },
  },
)
await supabase.auth.signInWithPassword({ email: 'manager@zenzero.com', password: 'ManagerPass123!' })
const cookieHeader = cookies.map((c) => c.name + '=' + c.value).join('; ')

const res = await fetch('http://localhost:3000/manager/rates', { headers: { Cookie: cookieHeader }, redirect: 'manual' })
const html = await res.text()

// Look for unit ID patterns
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
const uuids = [...new Set(html.match(uuidRe) ?? [])]
console.log('UUIDs found:', uuids.slice(0, 5))

// Look for any name= attributes
const nameRe = /name="([^"]+)"/g
const names = [...new Set([...html.matchAll(nameRe)].map(m => m[1]))]
console.log('input names:', names.slice(0, 15))
