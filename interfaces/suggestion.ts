import type { TimestampLike } from "./timestamp"
import type { Song } from "./song"

export type SuggestionStatus = "pending" | "accepted" | "rejected"

export type SuggestionType =
  | "chord_change"
  | "add_chord"
  | "remove_chord"
  | "key_change"
  | "lyrics_change"
  | "new_song"
  | "other"

/**
 * The machine-readable change requested by the suggestion. Each kind maps to a
 * concrete mutation the admin can apply when accepting.
 */
export type SuggestionChange =
  | {
      kind: "chord_change"
      /** Target song section id. */
      sectionId: string
      lineIndex: number
      position: number
      /** Current chord (empty string when the chord is missing). */
      from: string
      /** Desired chord (empty string means delete the chord). */
      to: string
    }
  | { kind: "key_change"; from: string; to: string }
  | {
      kind: "lyrics_change"
      sectionId: string
      lineIndex: number
      from: string
      to: string
    }
  | {
      kind: "new_song"
      title: string
      artist: string
      key: string
      /** Full plain-text lyric block; parsed into sections on accept. */
      lyrics: string
    }
  | { kind: "other" }

export interface SongSuggestion {
  id: string
  organizationId: string
  /** null when the suggestion is a brand new song. */
  songId: string | null
  /** Denormalised for display so suggestions remain readable after deletion. */
  songTitle: string
  authorId: string
  authorName: string
  type: SuggestionType
  change: SuggestionChange
  /** Human readable summary, e.g. "Chorus · line 3 · position 12". */
  summary: string
  comment: string
  status: SuggestionStatus
  createdAt: TimestampLike
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: TimestampLike | null
  reviewNote: string
}

/** Fields a member supplies when submitting a suggestion. */
export interface SuggestionInput {
  songId: string | null
  songTitle: string
  type: SuggestionType
  change: SuggestionChange
  summary: string
  comment: string
}

export const PENDING_SUGGESTION_STATUS: SuggestionStatus = "pending"

export type SuggestionSong = Pick<Song, "id" | "title" | "artist">