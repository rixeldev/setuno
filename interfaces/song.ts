import type { TimestampLike } from "./timestamp"

/**
 * A chord anchored at an arbitrary character offset inside its lyric line.
 * `position` is the index of the character in `LyricLine.text` where the chord
 * starts (0 = beginning of the line).
 */
export interface ChordPosition {
  chord: string
  position: number
}

/** A single lyric line with its own set of positioned chords. */
export interface LyricLine {
  text: string
  chords: ChordPosition[]
}

export type SongSectionType =
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "bridge"
  | "outro"
  | "instrumental"
  | "custom"

export interface SongSection {
  /** Stable id so chords/suggestions can reference a section. */
  id: string
  type: SongSectionType
  /** Display label ("Verse 1", "Chorus", custom text...). */
  label: string
  lines: LyricLine[]
  /** Optional bar count for the section ("8 bars"), used as a rehearsal cue. */
  bars?: number
}

export interface Song {
  id: string
  organizationId: string
  title: string
  artist: string
  /** Effective display key. `originalKey` is preserved for reference. */
  key: string
  originalKey: string
  capo: number
  bpm: number | null
  /** Duration in seconds, or null when unknown. */
  durationSec: number | null
  genre: string
  notes: string
  tags: string[]
  sections: SongSection[]
  /** Optional external references (roadmap #16). */
  links: SongLinks
  /**
   * Per-song files and links (roadmap #40): a PDF uploaded to Storage or an
   * arbitrary URL (chart, rehearsal recording), each with its own note.
   * Absent on older documents, so reads self-heal to `[]` — no migration.
   * Deliberately **not** on `SongInput`: attachments are written through
   * `services/songAttachments.ts` (one field at a time), so a lyrics save can
   * never clobber them and a version restore never touches them.
   */
  attachments: SongAttachment[]
  /** Repertoire status (roadmap #30): absent documents read as `active`. */
  status: SongStatus
  /**
   * Trash (roadmap #31): `null`/absent = live, a timestamp = soft-deleted.
   * Client time, so an offline trash is visible before the write flushes.
   */
  deletedAt: TimestampLike | null
  /** Who trashed it (roadmap #31); cleared together with `deletedAt`. */
  deletedBy: string | null
  createdBy: string
  createdByName: string
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

/** Streaming/listening services a song can point at (roadmap #16). */
export type SongLinkProvider = "youtube" | "spotify" | "appleMusic"

/**
 * Optional external links for a song. Every provider is always present; an
 * empty string means "not set". Stored as a map so a new provider is one key.
 */
export type SongLinks = Record<SongLinkProvider, string>

export const EMPTY_SONG_LINKS: SongLinks = { youtube: "", spotify: "", appleMusic: "" }

/** What an attachment is: a PDF uploaded to Storage, or a plain URL. */
export type SongAttachmentKind = "file" | "link"

/**
 * One attachment on a song (roadmap #40). A `file` carries its Storage `path`
 * (what put it there) plus the tokenized download `url`; a `link` is the URL
 * the user typed and has no `path`. `note` is the entry's own metadata
 * ("chart in Bb", "rehearsal take 2"); `uploadedBy`/`uploadedByName`/
 * `uploadedAt` say who put it on the song (client time — an offline attach
 * shows immediately, like every other stamp in the app).
 */
export interface SongAttachment {
  /** Stable id, unique within the song's list (removal keys off it). */
  id: string
  kind: SongAttachmentKind
  /** Display label; never empty after sanitizing. */
  name: string
  /** https URL: the download URL of a file, or the link itself. */
  url: string
  /** Storage path for `file` entries (`""` for links). */
  path: string
  /** Size in bytes (0 for links). */
  size: number
  /** Optional per-entry note (#40's "notes metadata"). */
  note: string
  uploadedBy: string
  uploadedByName: string
  /** Null when an older/hand-edited entry never carried a stamp. */
  uploadedAt: TimestampLike | null
}

/**
 * Where a song sits in the band's repertoire (roadmap #30). Absence in a
 * stored document reads back as `active`, so documents written before #30
 * need no migration.
 */
export type SongStatus = "draft" | "active" | "retired"

/** Fields an admin can edit; identity/audit fields are managed by the service. */
export interface SongInput {
  title: string
  artist: string
  key: string
  originalKey: string
  capo: number
  bpm: number | null
  durationSec: number | null
  genre: string
  notes: string
  tags: string[]
  sections: SongSection[]
  links: SongLinks
  /**
   * Required, not optional: `updateSong` writes the whole input, so an
   * omitted optional would silently reset every song to active on save
   * (#42's trap).
   */
  status: SongStatus
}

/**
 * The state a save replaced (roadmap #26): written to
 * `songs/{id}/versions` on every admin save, capped and pruned. `data` is
 * exactly what restoring the version writes back, so the history list never
 * joins a version against the song to be usable.
 */
export interface SongVersion {
  id: string
  data: SongInput
  savedAt: TimestampLike
  savedBy: string
  savedByName: string
}

/** Chips used by the song filters. */
export interface SongFacets {
  artists: string[]
  genres: string[]
  keys: string[]
  tags: string[]
}

export const EMPTY_FACETS: SongFacets = { artists: [], genres: [], keys: [], tags: [] }