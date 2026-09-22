#!/usr/bin/env node
/**
 * Preflight: HEAD-check the 13 Google image URLs from V1_Prototype that
 * scripts/migrate-images.mjs would attempt to download. Confirms whether
 * the V1 signed URLs are still alive before deciding to migrate vs manual-upload.
 *
 * Usage:
 *   npx tsx scripts/preflight-google-urls.mts
 *   npm run images:preflight
 *
 * Exit code:
 *   0 — at least 1 URL alive (V1 migration viable)
 *   1 — all URLs dead (manual upload required)
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

type Mapping = { urlIndex: number; key: string; name: string }
type Page = { file: string; label: string; mappings: Mapping[] }
type Config = { pages: Record<string, Page> }

const GOOGLE_RE = /https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_/\-=]+/g

function extractGoogleUrls(html: string): string[] {
  const matches = html.match(GOOGLE_RE) ?? []
  return Array.from(new Set(matches))
}

async function headCheck(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number | string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' })
    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, status: e instanceof Error ? e.name : 'error' }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  const configPath = 'scripts/migration-config.json'
  const config = JSON.parse(await readFile(configPath, 'utf8')) as Config

  const rows: Array<{ key: string; name: string; status: string; ok: boolean; url: string }> = []

  for (const [pageId, page] of Object.entries(config.pages)) {
    if (!existsSync(page.file)) {
      for (const m of page.mappings) {
        rows.push({ key: m.key, name: m.name, status: 'html_missing', ok: false, url: page.file })
      }
      continue
    }
    const html = await readFile(page.file, 'utf8')
    const urls = extractGoogleUrls(html)
    for (const m of page.mappings) {
      const url = urls[m.urlIndex]
      if (!url) {
        rows.push({ key: m.key, name: m.name, status: 'no_url_at_index', ok: false, url: '' })
        continue
      }
      const { ok, status } = await headCheck(url)
      rows.push({ key: m.key, name: m.name, status: String(status), ok, url })
    }
  }

  console.log('\n=== Google URL preflight ===\n')
  console.table(rows.map(r => ({ key: r.key, status: r.status, ok: r.ok ? '✅' : '❌' })))
  console.log(`\nSummary: ${rows.filter(r => r.ok).length}/${rows.length} URLs alive`)

  const anyAlive = rows.some(r => r.ok)
  if (anyAlive) {
    console.log('\n→ V1 URLs still alive — `npm run images:migrate` should work for at least some keys.')
    process.exit(0)
  } else {
    console.log('\n→ All V1 URLs dead — manual upload via `node scripts/upload-image.mjs --manifest=...` required.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Preflight failed:', err)
  process.exit(2)
})
