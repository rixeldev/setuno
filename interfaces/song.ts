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
  createdBy: string
  createdByName: string
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

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
}

/** Chips used by the song filters. */
export interface SongFacets {
  artists: string[]
  genres: string[]
  keys: string[]
  tags: string[]
}

export const EMPTY_FACETS: SongFacets = { artists: [], genres: [], keys: [], tags: [] }