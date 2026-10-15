/**
 * Private collections (roadmap #33). Everything here is pure so the clamps the
 * security rules enforce are the same clamps the client applies before writing —
 * a hand-edited document can never push a write out of the accepted shape, and
 * the list can never grow without bound. (Favorites are one document per song,
 * so they carry no list to clamp.)
 */
export const MAX_COLLECTION_SONGS = 500
export const MAX_COLLECTION_NAME = 80

/**
 * Rebuilds a stored song-id list from untrusted data: strings only, blanks
 * dropped, order preserved, duplicates removed (a set of ids is a *set*) and
 * the list capped — the same shape `services/` writes and the rules accept.
 */
export const sanitizeSongIds = (raw: unknown, cap = MAX_COLLECTION_SONGS): string[] => {
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of raw) {
    if (typeof value !== "string" || value.length === 0 || seen.has(value)) continue
    seen.add(value)
    ids.push(value)
    if (ids.length >= cap) break
  }
  return ids
}

/**
 * A collection name: trimmed and bounded. Empty means "no name", which the
 * rules reject — `null` here so the UI can ask again instead of writing it.
 */
export const collectionName = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null
  const name = raw.trim().slice(0, MAX_COLLECTION_NAME)
  return name.length > 0 ? name : null
}
