import { useCallback, useEffect, useRef } from "react"

import { saveReaderState } from "@/services/readerState"
import { maxScrollOffset } from "@/libs/autoscroll"
import { scrollRatioFor } from "@/libs/readerState"

/** How long the reader must rest before the position is written. */
const POSITION_SAVE_DELAY = 1200

/** Feeds one scroll sample to the saver. */
export type ReadingPositionReporter = (
  offset: number,
  contentHeight: number,
  viewportHeight: number,
) => void

interface PendingPosition {
  uid: string
  songId: string
  ratio: number
}

/**
 * Persists where the reader stopped (roadmap #4), as a 0..1 ratio so the same
 * spot is restored on the next open. Writes are debounced — the lyrics scroll
 * dozens of times a second — and flushed when the song or the screen goes away.
 * A song that already fits on screen has no position to remember.
 *
 * Returns the reporter the `ScrollView` handler calls on every scroll event;
 * it is a no-op while the user is signed out.
 */
export const useReadingPosition = (
  uid: string | null,
  songId: string | null,
): ReadingPositionReporter => {
  const pendingRef = useRef<PendingPosition | null>(null)
  const writtenRef = useRef<PendingPosition | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    if (!pending) return
    const written = writtenRef.current
    if (written?.songId === pending.songId && written.ratio === pending.ratio) return
    writtenRef.current = pending
    void saveReaderState(pending.uid, pending.songId, { scrollRatio: pending.ratio }).catch(
      () => undefined,
    )
  }, [])

  // A different song (or leaving the reader) writes whatever is still pending.
  useEffect(() => flush, [flush, songId])

  return useCallback<ReadingPositionReporter>(
    (offset, contentHeight, viewportHeight) => {
      if (!uid || !songId) return
      if (maxScrollOffset(contentHeight, viewportHeight) <= 0) return
      pendingRef.current = { uid, songId, ratio: scrollRatioFor(offset, contentHeight, viewportHeight) }
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, POSITION_SAVE_DELAY)
    },
    [uid, songId, flush],
  )
}
