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
  /** Repertoire status (roadmap #30): absent documents read as `active`. */
  status: SongStatus
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