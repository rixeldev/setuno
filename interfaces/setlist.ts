import type { TimestampLike } from "./timestamp"

export interface SetlistSong {
  songId: string
  /** Cached for fast rendering without extra reads. */
  title: string
  artist: string
  key: string
  /** Position in the setlist (0-based, contiguous). */
  order: number
}

export interface Setlist {
  id: string
  organizationId: string
  name: string
  description: string
  /** ISO date (yyyy-mm-dd) the setlist is intended for, when known. */
  date: string | null
  notes: string
  songs: SetlistSong[]
  /** Sum of known song durations, in seconds. */
  estimatedDurationSec: number
  createdBy: string
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

export interface SetlistInput {
  name: string
  description: string
  date: string | null
  notes: string
  songIds: string[]
  /**
   * Key each song will be played in, keyed by song id. Falls back to the song's
   * own key when missing.
   */
  songKeys?: Record<string, string>
}

/** Setlist row enriched with the resolved song object for rendering. */
export interface SetlistWithSongs extends Setlist {
  resolvedSongs: import("./song").Song[]
}