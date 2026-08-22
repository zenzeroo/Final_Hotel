import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'
import { writeFileSync } from 'node:fs'

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

await supabase.auth.signInWithPassword({ email: 'manager@zenzero.com', password: 'ManagerPass123!' })
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

const res = await fetch('http://localhost:3000/manager/reports', {
  headers: { Cookie: cookieHeader },
  redirect: 'manual',
})
const html = await res.text()

for (const tok of ['Penthouse', '4.2', '65', '25', 'User Web', 'Walk-in', 'OTA', 'Cancellation', 'Chart']) {
  const escaped = html.includes(tok)
  console.log(`  ${escaped ? '✓' : '✗'} literal "${tok}"`)
}
console.log('---')
// Look for the doughnut slice legend
const idx = html.indexOf('Booking Channels')
if (idx > 0) console.log('Around "Booking Channels":', html.slice(idx, idx + 400))
console.log('---')
const idx2 = html.indexOf('Cancellation')
if (idx2 > 0) console.log('Around "Cancellation":', html.slice(idx2, idx2 + 400))
console.log('---')
const idx3 = html.indexOf('Penthouse')
if (idx3 > 0) console.log('Around "Penthouse":', html.slice(idx3, idx3 + 200))
