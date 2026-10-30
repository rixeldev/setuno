import type { ShowNote } from "@/interfaces/performance"

/**
 * Night notes (roadmap #90): the quick, timestamped lines the band writes while
 * a show runs — from the reader's live strip — and afterwards in the post-gig
 * report, so the review has the context the show log cannot carry ("PA died
 * here", "the bride asked for this one").
 *
 * Pure and synchronous, like every other derived helper in `libs/`. The feed
 * lives on the event as `showNotes`, written field-level by
 * `services/performances.ts#saveShowNotes`; `firestore.rules` pins the list
 * shape (≤ {@link MAX_SHOW_NOTES} entries, every field present) and each entry
 * is sanitized here on read and write — rules cannot iterate a list, exactly
 * like the show log's `markers` precedent.
 */

/** Longest note the UI accepts; matches the rules' `body.size() <= 500`. */
export const SHOW_NOTE_BODY_MAX = 500

/** Entries one event may keep; matches the rules' `showNotes.size() <= 200`. */
export const MAX_SHOW_NOTES = 200

/** The note as it will be stored: one line per paragraph, trimmed, clamped. */
export const sanitizeShowNoteBody = (raw: string): string | null => {
  const trimmed = raw.replace(/\r\n?/g, "\n").trim()
  if (trimmed.length === 0) return null
  if (trimmed.length <= SHOW_NOTE_BODY_MAX) return trimmed
  const cut = trimmed.slice(0, SHOW_NOTE_BODY_MAX)
  // An emoji sitting exactly on the cut would leave half a surrogate pair.
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut
}

/**
 * A stored feed, healed: entries with no body or no readable stamp drop out,
 * ids are made unique (two notes written in the same millisecond by two phones
 * must not fight over one key), the list is ordered by time and then id so it
 * cannot shuffle between renders, and the oldest beyond
 * {@link MAX_SHOW_NOTES} go first.
 */
export const sanitizeShowNotes = (value: unknown): ShowNote[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const notes: ShowNote[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const data = raw as Record<string, unknown>
    const body = typeof data.body === "string" ? sanitizeShowNoteBody(data.body) : null
    if (body === null) continue
    const at = typeof data.at === "number" && Number.isFinite(data.at) ? data.at : null
    if (at === null) continue
    const base = typeof data.id === "string" && data.id.trim().length > 0 ? data.id.trim() : `note-${at}`
    let id = base
    let suffix = 2
    while (seen.has(id)) id = `${base}-${suffix++}`
    seen.add(id)
    notes.push({
      id,
      songId: typeof data.songId === "string" ? data.songId : "",
      at,
      body,
      authorId: typeof data.authorId === "string" ? data.authorId : "",
      authorName: typeof data.authorName === "string" ? data.authorName.slice(0, 80) : "",
    })
  }
  return notes
    .sort((first, second) => (first.at !== second.at ? first.at - second.at : first.id < second.id ? -1 : first.id > second.id ? 1 : 0))
    .slice(-MAX_SHOW_NOTES)
}

/** One id no other note in the feed is using, even within the same millisecond. */
const nextShowNoteId = (notes: readonly ShowNote[], now: number): string => {
  const base = `note-${now}`
  const used = new Set(notes.map((note) => note.id))
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix++
  return `${base}-${suffix}`
}

export interface ShowNoteDraft {
  /** Song on screen when it was written; `""` for a note about the night. */
  songId: string
  body: string
  authorId: string
  authorName: string
}

/**
 * Appends one note, stamped with `now` (client time, offline-safe). A blank
 * body writes nothing — the caller's Save button is disabled anyway, but a
 * queued double tap must not invent an empty line in the report.
 */
export const appendShowNote = (
  notes: readonly ShowNote[],
  draft: ShowNoteDraft,
  now: number,
): ShowNote[] => {
  const current = sanitizeShowNotes(notes)
  const body = sanitizeShowNoteBody(draft.body)
  if (body === null) return current
  return sanitizeShowNotes([
    ...current,
    {
      id: nextShowNoteId(current, now),
      songId: draft.songId,
      at: now,
      body,
      authorId: draft.authorId,
      authorName: draft.authorName.slice(0, 80),
    },
  ])
}

/** Drops one note; an unknown id leaves the feed exactly as it was. */
export const removeShowNote = (notes: readonly ShowNote[], id: string): ShowNote[] =>
  sanitizeShowNotes(notes).filter((note) => note.id !== id)
