import type { AnnotationMarker, Setlist, SetlistBlock, Song, SongSuggestion } from "@/interfaces"
import { ANNOTATION_MARKERS_LIMIT, ANNOTATION_NOTES_LIMIT, annotationFromData } from "@/libs/annotations"
import { findDuplicateSongs } from "@/libs/songSearch"
import { clampAutoscrollDelay, clampAutoscrollSpeed } from "@/libs/autoscroll"
import {
  clampReaderCapo,
  clampReaderFontSize,
  clampReaderSemitones,
  clampScrollRatio,
} from "@/libs/readerState"

/**
 * Pure core of duplicate + merge (roadmap #32): everything the merge decides —
 * which setlist entries move, which song wins a slot, what fits in a personal
 * note document, which copy of the library is the likely duplicate — is decided
 * here without touching Firestore, so the counts the confirm dialog shows and
 * the writes the service performs come from one implementation and can never
 * disagree.
 */

/**
 * The title a duplicate gets: the source's title plus the caller's localized
 * suffix (`" (copy)"`), bounded to the same limit `normalizeSongInput` enforces
 * so a copy of an already-max-length title still passes the song rules.
 */
export const SONG_TITLE_LIMIT = 120

export const duplicateSongTitle = (title: string, suffix: string): string =>
  `${title}${suffix}`.slice(0, SONG_TITLE_LIMIT)

/**
 * Everything one setlist needs to be repointed from the loser to the master
 * song — the same four values `updateSetlist` writes, so the merge reuses that
 * write path rather than inventing a second one.
 */
export interface SetlistRepoint {
  songIds: string[]
  songKeys: Record<string, string>
  songNotes: Record<string, string>
  /** Who plays what, per song id (#88) — carried with the song it belongs to. */
  songLineups: Record<string, Record<string, string>>
  blocks: SetlistBlock[]
  /** False when the list never mentioned the loser: nothing to write. */
  changed: boolean
}

/**
 * Rewrites one list so every reference to `loserId` becomes `masterId`.
 *
 * When **both** songs already sit in the list — the interesting case: two
 * duplicates in the same running order — the merge keeps the **first slot**
 * (a merge must not reorder the gig) but the **master's own entry content**
 * (the key and note the band set for the song being kept), dropping only the
 * loser's entry. Keys and notes are written only when non-empty, so an empty
 * value lets `buildSetlistSongs` fall back to the master song's own key
 * instead of pinning the entry to "".
 */
export const repointSetlist = (
  setlist: Setlist,
  loserId: string,
  masterId: string,
): SetlistRepoint => {
  const songIds: string[] = []
  const songKeys: Record<string, string> = {}
  const songNotes: Record<string, string> = {}
  // The line-ups travel with the entry they were written for: a merge must not
  // lose the band's answer to "who plays this one" (roadmap #88).
  const songLineups: Record<string, Record<string, string>> = {}
  const hasLineup = (lineup: Record<string, string> | undefined): boolean =>
    lineup !== undefined && Object.keys(lineup).length > 0
  const slots = new Map<string, number>()
  let changed = false

  for (const entry of setlist.songs) {
    const id = entry.songId === loserId ? masterId : entry.songId
    if (!slots.has(id)) {
      slots.set(id, songIds.length)
      songIds.push(id)
      if (entry.key) songKeys[id] = entry.key
      if (entry.note) songNotes[id] = entry.note
      if (hasLineup(entry.lineup)) songLineups[id] = entry.lineup
      if (id !== entry.songId) changed = true
      continue
    }

    // Both songs are already in this list: the master's own entry overwrites
    // the content of the slot the pair shares (its position wins, its key and
    // note belong to the song being kept).
    changed = true
    if (entry.songId === masterId) {
      if (entry.key) songKeys[id] = entry.key
      else delete songKeys[id]
      if (entry.note) songNotes[id] = entry.note
      else delete songNotes[id]
      // The kept song's own line-up wins; when it has none, the slot keeps the
      // one the loser carried rather than dropping the band's cast.
      if (hasLineup(entry.lineup)) songLineups[id] = entry.lineup
    }
  }

  const blocks = setlist.blocks.map((block) => {
    if (block.afterSongId !== loserId) return block
    changed = true
    return { ...block, afterSongId: masterId }
  })

  return { songIds, songKeys, songNotes, songLineups, blocks, changed }
}

/** True when a list would actually change under `repointSetlist`. */
export const setlistReferencesSong = (setlist: Setlist, songId: string): boolean =>
  setlist.songs.some((entry) => entry.songId === songId) ||
  setlist.blocks.some((block) => block.afterSongId === songId)

/** What a merge will move — the numbers the confirm dialog prints. */
export const mergeCounts = (
  setlists: Setlist[],
  suggestions: SongSuggestion[],
  loserId: string,
): { setlists: number; suggestions: number } => ({
  setlists: setlists.filter((setlist) => setlistReferencesSong(setlist, loserId)).length,
  suggestions: suggestions.filter((suggestion) => suggestion.songId === loserId).length,
})

export interface MergeCandidate {
  song: Song
  /** Same normalized title as the song being merged (the #39 matcher's hit). */
  sameTitle: boolean
}

/**
 * Orders the merge picker: `findDuplicateSongs`' hits come first — same
 * normalized title with compatible artists (both equal, or either side
 * uncredited; the matcher skips pairs where both credit a different artist) —
 * with same-artist ahead, and the rest follow alphabetically. The song being
 * merged away from is excluded here, so a caller cannot offer it back to
 * itself.
 */
export const mergeCandidates = (candidates: Song[], current: Song): MergeCandidate[] => {
  const others = candidates.filter((song) => song.id !== current.id)
  const dupes = findDuplicateSongs(others, { title: current.title, artist: current.artist })
  const matched = new Set(dupes.map((dupe) => dupe.song.id))
  const rest = others
    .filter((song) => !matched.has(song.id))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((song) => ({ song, sameTitle: false }))
  return [...dupes.map((dupe) => ({ song: dupe.song, sameTitle: true })), ...rest]
}

/** The stored shape of a personal annotation document (no `songId`: doc id). */
export interface AnnotationSnapshot {
  notes: string
  markers: AnnotationMarker[]
}

export interface AnnotationMerge {
  /** The document to write at the master's id, or null for "touch nothing". */
  merged: AnnotationSnapshot | null
  /** Everything from the loser made it into `merged`: safe to delete it. */
  complete: boolean
}

/**
 * Combines the acting user's own annotations for the two songs.
 *
 * - No loser document: nothing to do.
 * - No master document: the loser's document moves over wholesale.
 * - Both: notes concatenate (master first) and markers append, duplicates by
 *   id dropped.
 *
 * When the combined result would exceed what the security rules accept
 * (2000 chars / 50 markers), **neither document is touched and the loser's is
 * kept**: a merge only deletes content it actually copied. Other members'
 * documents are unreachable by design (owner-only rules) and stay under the
 * old song id — documented in AGENTS.md rather than worked around.
 */
export const mergeAnnotationDocs = (
  master: AnnotationSnapshot | null,
  loser: AnnotationSnapshot | null,
): AnnotationMerge => {
  if (!loser) return { merged: null, complete: true }
  if (!master) return { merged: loser, complete: true }

  const notes = [master.notes.trim(), loser.notes.trim()].filter((value) => value.length > 0)
  const joined = notes.join("\n\n")
  const seen = new Set<string>()
  const markers: AnnotationMarker[] = []
  for (const marker of [...master.markers, ...loser.markers]) {
    if (seen.has(marker.id)) continue
    seen.add(marker.id)
    markers.push(marker)
  }

  if (joined.length > ANNOTATION_NOTES_LIMIT || markers.length > ANNOTATION_MARKERS_LIMIT) {
    return { merged: null, complete: false }
  }
  return { merged: { notes: joined, markers }, complete: true }
}

/**
 * Reads a stored reader-state document into only the fields the rules whitelist
 * (`readerStateKeys()`), each run through the same clamp it is saved with — the
 * values are re-validated by the rules on write, so copying an out-of-range
 * legacy value would have the whole merge batch rejected.
 */
export const readerStateCopy = (raw: Record<string, unknown>): Record<string, number> => {
  const out: Record<string, number> = {}
  if (typeof raw.autoscrollSpeed === "number") {
    out.autoscrollSpeed = clampAutoscrollSpeed(raw.autoscrollSpeed)
  }
  if (typeof raw.autoscrollDelay === "number") {
    out.autoscrollDelay = clampAutoscrollDelay(raw.autoscrollDelay)
  }
  if (typeof raw.scrollRatio === "number") out.scrollRatio = clampScrollRatio(raw.scrollRatio)
  if (typeof raw.semitones === "number") out.semitones = clampReaderSemitones(raw.semitones)
  if (typeof raw.capo === "number") out.capo = clampReaderCapo(raw.capo)
  if (typeof raw.fontSize === "number") out.fontSize = clampReaderFontSize(raw.fontSize)
  return out
}

/** Sanitizes a stored annotation document the way the reader would on read. */
export const annotationSnapshot = (raw: Record<string, unknown>): AnnotationSnapshot => {
  const parsed = annotationFromData(raw)
  return { notes: parsed.notes, markers: parsed.markers }
}
