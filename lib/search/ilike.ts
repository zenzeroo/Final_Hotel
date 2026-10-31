/**
 * Turn free text from a search box into a `%term%` pattern that is safe to
 * interpolate into a PostgREST `.or('col.ilike.<pattern>,…')` filter.
 *
 * `.or()` takes a comma-separated filter string, so a comma, bracket, quote or
 * backslash in the user's text would split or break the filter (a search for
 * "Smith, John" errored the page). `%` / `_` / `*` would act as wildcards.
 * Those characters are replaced with a space; runs of spaces collapse.
 * Returns null when nothing searchable is left.
 */
export function ilikePattern(raw: string | null | undefined): string | null {
  const term = (raw ?? '')
    .replace(/[,()"'\\%_*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
  return term ? `%${term}%` : null
}
