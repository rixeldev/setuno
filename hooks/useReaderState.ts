import { useEffect, useState } from "react"

import { subscribeReaderState, type ReaderState } from "@/services/readerState"

/**
 * A saved reader-state document plus the song it belongs to. The song id is
 * what tells a fresh snapshot apart from a stale one when the reader steps to
 * the next song: the previous document can still be in state for a commit.
 */
export interface ReaderStateSnapshot extends ReaderState {
  songId: string
}

/** The document currently in state, tagged with the song/user it came from. */
interface ReaderStateEntry {
  key: string
  value: ReaderStateSnapshot
}

/**
 * Live personal reader state of one song for the signed-in user (roadmap #1).
 * Returns `null` until the document arrives (or when it has never been written,
 * in which case the reader keeps its defaults).
 */
export const useReaderState = (
  uid: string | null,
  songId: string | null,
): ReaderStateSnapshot | null => {
  const [entry, setEntry] = useState<ReaderStateEntry | null>(null)
  const key = uid && songId ? `${uid}/${songId}` : null

  useEffect(() => {
    if (!key || !uid || !songId) return undefined
    return subscribeReaderState(uid, songId, (state) => {
      setEntry({ key, value: { songId, ...(state ?? {}) } })
    })
  }, [key, uid, songId])

  // A document from another song (or another user) can still be in state for a
  // commit after the reader steps on: reading it as "not loaded yet" avoids
  // flashing the previous song's settings for a frame.
  return entry && entry.key === key ? entry.value : null
}
