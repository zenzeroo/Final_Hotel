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
await supabase.auth.signInWithPassword({ email: 'manager@zenzero.com', password: process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!' })
const cookieHeader = cookies.map((c) => c.name + '=' + c.value).join('; ')

for (const tab of ['', '?tab=refunds', '?tab=audit']) {
  const url = 'http://localhost:3000/manager/bookings' + tab
  const res = await fetch(url, { headers: { Cookie: cookieHeader }, redirect: 'manual' })
  const text = await res.text()
  console.log('\n=== ' + url + ' (HTTP ' + res.status + ') ===')
  if (res.status >= 400) {
    const errMatch = text.match(/<title>(.*?)<\/title>/)
    const h1Match = text.match(/<h1[^>]*>(.*?)<\/h1>/)
    const errMsg = text.match(/Error:[^<]+/)
    console.log('  title:', errMatch?.[1]?.slice(0, 120))
    console.log('  h1:', h1Match?.[1]?.slice(0, 120))
    console.log('  err:', errMsg?.[0]?.slice(0, 200))
  }
}
