import type { TimestampLike } from "./timestamp"

/**
 * A private, per-user list of songs (roadmap #33) — a personal draft the band
 * never sees. Songs are referenced by id and resolved against the band's
 * library, exactly like a setlist entry, so a song that left the band simply
 * stops resolving instead of dragging data along.
 */
export interface UserCollection {
  id: string
  name: string
  /** Ordered as added; the reader of a draft is the one who ordered it. */
  songIds: string[]
  createdAt: TimestampLike | null
  updatedAt: TimestampLike | null
}
