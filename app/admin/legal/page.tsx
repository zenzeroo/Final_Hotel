import { getCurrentLegalVersion, getLegalDraft, listLegalVersions } from '@/lib/data/legal'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { LegalDocsManager } from './LegalDocsManager'

export const dynamic = 'force-dynamic'

/**
 * Phase 62 — admin uploads the four legal PDFs (privacy / terms × TH / EN)
 * into a draft, previews them, and publishes once. Each publish is a new
 * consent version: every customer is asked to accept it again.
 * Admin-only — `app/admin/layout.tsx` enforces the role.
 */
export default async function AdminLegalPage() {
  const t = getT(await getLocale())
  const [draft, current, versions] = await Promise.all([
    getLegalDraft(),
    getCurrentLegalVersion(),
    listLegalVersions(),
  ])

  // Publisher names for the history table.
  const ids = [...new Set(versions.map((v) => v.publishedBy).filter((id): id is string => !!id))]
  const names: Record<string, string> = {}
  if (ids.length > 0) {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
    for (const p of data ?? []) names[p.id] = p.full_name || p.email || ''
  }

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">{t('admin.legalPage.title')}</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">{t('admin.legalPage.subtitle')}</p>
      </header>
      <LegalDocsManager
        draft={draft}
        current={current}
        versions={versions.map((v) => ({ ...v, publisherName: v.publishedBy ? names[v.publishedBy] ?? '' : '' }))}
      />
    </div>
  )
}
