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

// Find the close/reopen buttons and look at form structure around them
const i = html.indexOf('ปิดซ่อมบำรุง')
if (i > 0) {
  console.log('--- around first ปิดซ่อมบำรุง ---')
  console.log(html.slice(Math.max(0, i - 800), i + 200))
}
