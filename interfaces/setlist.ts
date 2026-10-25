import type { TimestampLike } from "./timestamp"

export interface SetlistSong {
  songId: string
  /** Cached for fast rendering without extra reads. */
  title: string
  artist: string
  key: string
  /** Position in the setlist (0-based, contiguous). */
  order: number
  /**
   * The band's shared note for *this entry* (roadmap #43): "tune Eb", "starts
   * alone". On the setlist, never on the song — the same song can be called
   * something different in two lists. Empty string when unset.
   */
  note: string
  /**
   * Who plays what on this song (roadmap #88): **member uid → role id**, with
   * one role per member and any number of members per role. Keyed by uid so a
   * reorder carries it with its song, and stored on the entry rather than on the
   * song — the line-up is the night's, not the songbook's. Empty on documents
   * written before this shipped, so no migration exists.
   */
  lineup: Record<string, string>
}

/**
 * A divider in the running order — Set 1 / Set 2 / Break / Encore (roadmap #43).
 *
 * Anchored to a **song**, never to a position: reordering the list then carries
 * the divider with its music. `afterSongId` (rather than "before") makes every
 * gap expressible — `null` is the top, a song id is the gap right after it,
 * including the bottom after the last song.
 */
export interface SetlistBlock {
  id: string
  name: string
  afterSongId: string | null
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
  /** Dividers splitting the running order into sets (roadmap #43). */
  blocks: SetlistBlock[]
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
   * Required for the same reason as the goal: the running-order editor writes
   * through `updateSetlist` with an object that only means "the order changed",
   * and an optional left out of it would drop every divider on the next
   * reorder.
   */
  blocks: SetlistBlock[]
  /**
   * Note per song id, mirroring `songKeys` so a reorder carries each note with
   * its song instead of with a position. Required for the same reason as
   * `blocks`.
   */
  songNotes: Record<string, string>
  /**
   * Line-up per song id (roadmap #88), mirrored the same way: reordering the
   * list never moves a member to another song. Required, exactly like
   * `songNotes` and `blocks` — the running-order editor rewrites the document
   * with an object that only means "the order changed", and an optional left
   * out of it would wipe the band's line-ups on the next reorder.
   */
  songLineups: Record<string, Record<string, string>>
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