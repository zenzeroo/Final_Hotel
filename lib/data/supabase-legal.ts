/**
 * Phase 62 — admin-uploaded legal documents (PDF).
 *
 * legal_versions: published versions (public read, written only by the
 * publish_legal_version() RPC). legal_draft: singleton row of uploaded but
 * unpublished R2 keys (admin read/update via RLS).
 */
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { wrapSupabaseError } from '@/lib/errors/supabase'
import { isUuid } from '@/lib/ids'
import { consentVersionOf } from '@/lib/consent'
import { deleteLegalObjectIfUnpublished } from '@/lib/r2/upload-pdf'
import { LEGAL_DOCS, LEGAL_DOC_COLUMN, type LegalDoc, type LegalKeys } from '@/lib/legal/docs'
import {
  fetchCurrentLegalVersion,
  toLegalVersionRow,
  LEGAL_VERSION_COLUMNS,
  type LegalVersionRow,
} from '@/lib/legal/current'

/** Newest published version, or null while none has been published (once per request). */
export const getCurrentLegalVersion = cache(async (): Promise<LegalVersionRow | null> => {
  const supabase = await createClient()
  return fetchCurrentLegalVersion(supabase)
})

/** The version customers must have accepted (falls back to PRIVACY_POLICY_VERSION). */
export async function getCurrentConsentVersion(): Promise<string> {
  return consentVersionOf(await getCurrentLegalVersion())
}

export async function getLegalVersionById(id: string): Promise<LegalVersionRow | null> {
  if (!isUuid(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('legal_versions')
    .select(LEGAL_VERSION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) wrapSupabaseError('getLegalVersionById', error)
  return data ? toLegalVersionRow(data) : null
}

export async function listLegalVersions(): Promise<LegalVersionRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('legal_versions')
    .select(LEGAL_VERSION_COLUMNS)
    .order('published_at', { ascending: false })
  if (error) wrapSupabaseError('listLegalVersions', error)
  return (data ?? []).map(toLegalVersionRow)
}

/** Draft R2 keys (admin only — RLS returns no row to anyone else). */
export async function getLegalDraft(): Promise<LegalKeys> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('legal_draft')
    .select('privacy_th_key, privacy_en_key, terms_th_key, terms_en_key')
    .eq('id', 1)
    .maybeSingle()
  if (error) wrapSupabaseError('getLegalDraft', error)
  const row = (data ?? {}) as Partial<Record<(typeof LEGAL_DOC_COLUMN)[LegalDoc], string | null>>
  return Object.fromEntries(
    LEGAL_DOCS.map((d) => [d, row[LEGAL_DOC_COLUMN[d]] ?? null]),
  ) as LegalKeys
}

/**
 * Set (or clear, with null) one draft slot. Returns the key it replaced.
 * Atomic RPC — takes the same row lock as publish_legal_version().
 */
export async function setLegalDraftKey(doc: LegalDoc, key: string | null): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_legal_draft_key', { p_doc: doc, p_key: key })
  if (error) {
    if (error.message.includes('FORBIDDEN')) throw new Error('FORBIDDEN')
    wrapSupabaseError('setLegalDraftKey', error)
  }
  return (data as string | null) ?? null
}

/** Delete a replaced draft object unless a published version uses it. */
export async function dropReplacedLegalObject(key: string | null): Promise<void> {
  const supabase = await createClient()
  await deleteLegalObjectIfUnpublished(supabase, key)
}

/**
 * Publish the draft as a new version (atomic RPC). Throws an Error whose
 * message is the RPC code: NOTHING_TO_PUBLISH | INCOMPLETE | FORBIDDEN.
 */
export async function publishLegalVersion(): Promise<LegalVersionRow> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('publish_legal_version')
  if (error) {
    const code = ['NOTHING_TO_PUBLISH', 'INCOMPLETE', 'FORBIDDEN'].find((c) => error.message.includes(c))
    if (code) throw new Error(code)
    wrapSupabaseError('publishLegalVersion', error)
  }
  return toLegalVersionRow(data)
}
