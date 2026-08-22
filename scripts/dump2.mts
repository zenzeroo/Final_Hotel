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

await supabase.auth.signInWithPassword({ email: 'manager@zenzero.com', password: 'ManagerPass123!' })
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

for (const path of ['/manager/housekeeping', '/manager/bookings', '/manager', '/manager/reports']) {
  const res = await fetch(`http://localhost:3000${path}`, {
    headers: { Cookie: cookieHeader },
    redirect: 'manual',
  })
  const html = await res.text()
  console.log(`\n=== ${path} (HTTP ${res.status}, ${(html.length / 1024).toFixed(1)}KB) ===`)
  console.log('  <table>:', (html.match(/<table/g) ?? []).length)
  console.log('  <h1>:', (html.match(/<h1/g) ?? []).length)
  console.log('  <h3>:', (html.match(/<h3/g) ?? []).length)
  console.log('  Damage Report:', (html.match(/Damage Report/g) ?? []).length)
  console.log('  Booking Oversight:', (html.match(/Booking Oversight/g) ?? []).length)
  console.log('  "Rooms" or "ห้อง":', (html.match(/Rooms|ห้อง/g) ?? []).length)
  console.log('  "Active Bookings":', (html.match(/Active Bookings/g) ?? []).length)
  console.log('  "Total Rooms":', (html.match(/Total Rooms/g) ?? []).length)
  // Save first chunk to inspect
  console.log('  excerpt:', html.slice(html.indexOf('<main'), html.indexOf('<main') + 200).replace(/\s+/g, ' ').slice(0, 200))
}
