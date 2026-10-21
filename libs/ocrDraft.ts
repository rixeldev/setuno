/**
 * The draft a scanned sheet leaves behind (roadmap #84).
 *
 * The scan screen proposes a song; the editor is where it is reviewed and
 * fixed. Between the two, the draft travels through a **token** in the URL
 * and a small store here — a proposal is far too long to be a query
 * parameter, and a token keeps the hand-off idempotent (the editor may read
 * it more than once).
 */

/** What the scan proposes to the editor. */
export interface SongDraft {
  title: string
  key: string | null
  capo: number | null
  bpm: number | null
  /** The lyrics, with the chords inline as `[C]` markers. */
  text: string
}

/** How many drafts are kept around. */
const MAX_DRAFTS = 5

const drafts = new Map<string, SongDraft>()
let counter = 0

/** Stores a draft and returns the token that finds it again. */
export const setSongDraft = (draft: SongDraft): string => {
  counter += 1
  const token = `draft-${counter}`
  drafts.set(token, draft)
  while (drafts.size > MAX_DRAFTS) {
    const oldest = drafts.keys().next().value
    if (oldest === undefined) break
    drafts.delete(oldest)
  }
  return token
}

/** The draft a token points at, if it is still there. */
export const getSongDraft = (token: string | undefined | null): SongDraft | null => {
  if (!token) return null
  return drafts.get(token) ?? null
}
