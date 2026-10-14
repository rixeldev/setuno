import type { TimestampLike } from "./timestamp"

/**
 * One private inline note anchored to a line of a song (docs §22, roadmap #3).
 *
 * The anchor is `sectionId` + `lineIndex` inside that section, so the note
 * survives transposition (display-only) and points at a stable text location.
 * `lineIndex === -1` anchors the note to the whole section instead.
 */
export interface AnnotationMarker {
  /** Stable id so notes can be edited or removed one at a time. */
  id: string
  sectionId: string
  /** Index of the lyric line inside the section, or -1 for the whole section. */
  lineIndex: number
  /** The private note itself ("I come in here", "second chorus only"...). */
  text: string
}

/** Shape the composer uses to create a marker. */
export interface AnnotationMarkerInput {
  sectionId: string
  lineIndex: number
  text: string
}

/**
 * Personal annotations of one song for one user, stored under
 * `users/{uid}/annotations/{songId}` (owner-only rules).
 *
 * Private by design: the band's song document is never touched, and no other
 * member can read or write these notes.
 */
export interface SongAnnotation {
  /** Free-form overall notes for the song. */
  notes: string
  /** Inline notes anchored to specific lines/sections. */
  markers: AnnotationMarker[]
  updatedAt?: TimestampLike
}