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
  /**
   * Minutes the band wants this list to fill (roadmap #42), `0` for no goal.
   * The **slot** is the target and `breakMinutes` eats into it, so 45/10 means
   * 35 minutes of music fit. Both are plain numbers on purpose: the readout is
   * computed from them on every render and never stored.
   */
  targetMinutes: number
  /** Minutes of break counted inside the target, `0` for none. */
  breakMinutes: number
  /**
   * A reusable starting point (roadmap #41: "45-min, acoustic, wedding")
   * rather than a running order built for one event. Templates carry no date
   * and get their own section on the setlists screen, outside the events that
   * group every other list. Absent on documents written before this shipped,
   * so it reads as `false`.
   */
  template: boolean
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
   * Required rather than optional: every caller already knows these (the form
   * holds them, the running-order editor reads them off the list), and an
   * omitted optional would silently reset the band's goal on the next reorder.
   */
  targetMinutes: number
  breakMinutes: number
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