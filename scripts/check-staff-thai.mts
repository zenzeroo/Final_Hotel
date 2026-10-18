/**
 * Phase 27.E — find hardcoded Thai UI strings left in the staff portals.
 *
 * Scans the staff routes + their component folders and prints every
 * non-comment line containing Thai characters. Target: 0. Intentional
 * Thai (e.g. a value written to the DB) can be allow-listed below with a
 * reason.
 *
 * Run: npx tsx scripts/check-staff-thai.mts           (summary + lines)
 *      npx tsx scripts/check-staff-thai.mts --summary (per-file counts only)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = [
  'app/manager',
  'app/reception',
  'app/housekeeper',
  'app/admin',
  'components/admin',
  'components/manager',
  'components/housekeeping',
  'components/layout/StaffSidebar.tsx',
  'components/layout/StaffMobileHeader.tsx',
  'components/booking/StaffBookingDetail.tsx',
]

/** file → substrings that may legitimately stay Thai, with the reason. */
const ALLOW: Record<string, Array<[string, string]>> = {}

const THAI = /[฀-๿]/
const summaryOnly = process.argv.includes('--summary')

function walk(p: string): string[] {
  const abs = join(ROOT, p)
  if (statSync(abs).isFile()) return [p]
  return readdirSync(abs).flatMap((name) => walk(join(p, name)))
}

function isComment(line: string, inBlock: boolean): boolean {
  const t = line.trim()
  return inBlock || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')
}

let total = 0
const perFile: Array<[string, number]> = []
for (const file of TARGETS.flatMap(walk).filter((f) => /\.(tsx?|mts)$/.test(f))) {
  const rel = relative(ROOT, join(ROOT, file)).replace(/\\/g, '/')
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n')
  let inBlock = false
  const hits: Array<[number, string]> = []
  lines.forEach((line, i) => {
    // Only a line that *starts* a comment opens a block — `accept="image/*"`
    // must not swallow the rest of the file.
    const trimmed = line.trim()
    const opens = (trimmed.startsWith('/*') || trimmed.startsWith('{/*')) && !line.includes('*/')
    const comment = isComment(line, inBlock)
    if (opens) inBlock = true
    if (inBlock && line.includes('*/')) inBlock = false
    if (comment || !THAI.test(line)) return
    if ((ALLOW[rel] ?? []).some(([s]) => line.includes(s))) return
    hits.push([i + 1, line.trim()])
  })
  if (hits.length) {
    perFile.push([rel, hits.length])
    total += hits.length
    if (!summaryOnly) for (const [n, l] of hits) console.log(`${rel}:${n}  ${l}`)
  }
}

console.log('\n--- per file ---')
for (const [f, n] of perFile.sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${f}`)
console.log(`\n${total} Thai line(s) in ${perFile.length} file(s)`)
process.exit(total ? 1 : 0)
