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

const res = await fetch('http://localhost:3000/manager/rates', { headers: { Cookie: cookieHeader } })
const html = await res.text()

// Find ALL unit_id references — RSC payload contains JSON-encoded props
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
const uuids = new Set<string>()
let m
while ((m = uuidRe.exec(html)) !== null) uuids.add(m[0])
console.log('UUID count:', uuids.size)
console.log('First 8:', [...uuids].slice(0, 8))

// Find "ปิดห้อง" occurrences (button label)
let pos = 0
let i = 0
while ((pos = html.indexOf('ปิดห้อง', pos)) > 0 && i < 3) {
  console.log(`\n--- occurrence ${i + 1} at idx ${pos} ---`)
  // Find prev uuid close to this position
  const prev = html.slice(0, pos)
  const lastUuid = [...prev.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)].pop()
  console.log('closest uuid:', lastUuid?.[0])
  console.log('snippet:')
  console.log(html.slice(Math.max(0, pos - 400), pos + 200))
  pos += 10
  i++
}
