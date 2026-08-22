import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const cookies: { name: string; value: string }[] = []
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll: () => cookies.map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) =>
        toSet.forEach(({ name, value }) => {
          const i = cookies.findIndex((c) => c.name === name)
          if (i >= 0) cookies[i] = { name, value }
          else cookies.push({ name, value })
        }),
    },
  },
)

const pw = process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!'
const { error } = await supabase.auth.signInWithPassword({
  email: 'manager@zenzero.com',
  password: pw,
})
if (error) throw new Error(error.message)

const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

for (const path of ['/manager', '/manager/housekeeping', '/manager/bookings']) {
  const res = await fetch(`http://localhost:3000${path}`, {
    headers: { Cookie: cookieHeader },
    redirect: 'manual',
  })
  console.log(`\n=== ${path} (HTTP ${res.status}) ===`)
  const html = await res.text()
  const amounts = html.match(/฿[\d,]+/g) ?? []
  console.log('  ฿ amounts (first 10):', [...new Set(amounts)].slice(0, 10))
  const frag = html.match(/[฀-๿]{3,}/g) ?? []
  console.log('  thai fragments:', [...new Set(frag)].slice(0, 15))
  // Search for known tokens
  for (const tok of ['รายได้', 'Walk-in', 'Eleanor', 'Somjit', 'Tahani', 'MGR-02', 'Heritage Suite', '1,245,000']) {
    if (html.includes(tok)) console.log(`  ✓ contains "${tok}"`)
    else console.log(`  ✗ missing   "${tok}"`)
  }
}
