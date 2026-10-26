// Thin re-export of the Supabase implementation (project convention).
export {
  getCurrentLegalVersion,
  getCurrentConsentVersion,
  getLegalVersionById,
  listLegalVersions,
  getLegalDraft,
  setLegalDraftKey,
  dropReplacedLegalObject,
  publishLegalVersion,
} from './supabase-legal'
