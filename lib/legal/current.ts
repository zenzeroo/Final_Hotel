import type { SupabaseClient } from '@supabase/supabase-js'
import type { LegalDoc } from './docs'

/**
 * Phase 62 — the newest published legal version (`legal_versions`, public
 * read). Plain module taking any Supabase client, so the proxy, server code
 * and scripts share one query.
 */
export interface LegalVersionRow {
  id: string
  version: string
  publishedAt: string
  publishedBy: string | null
  keys: Record<LegalDoc, string>
}

export const LEGAL_VERSION_COLUMNS =
  'id, version, published_at, published_by, privacy_th_key, privacy_en_key, terms_th_key, terms_en_key'

interface LegalVersionDbRow {
  id: string
  version: string
  published_at: string
  published_by: string | null
  privacy_th_key: string
  privacy_en_key: string
  terms_th_key: string
  terms_en_key: string
}

export function toLegalVersionRow(r: LegalVersionDbRow): LegalVersionRow {
  return {
    id: r.id,
    version: r.version,
    publishedAt: r.published_at,
    publishedBy: r.published_by,
    keys: {
      'privacy-th': r.privacy_th_key,
      'privacy-en': r.privacy_en_key,
      'terms-th': r.terms_th_key,
      'terms-en': r.terms_en_key,
    },
  }
}

export async function fetchCurrentLegalVersion(client: SupabaseClient): Promise<LegalVersionRow | null> {
  const { data, error } = await client
    .from('legal_versions')
    .select(LEGAL_VERSION_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`fetchCurrentLegalVersion: ${error.message}`)
  return data ? toLegalVersionRow(data as LegalVersionDbRow) : null
}
