import { useEffect, useState } from "react"

import { subscribeAnnotations } from "@/services/annotations"
import type { SongAnnotation } from "@/interfaces"

/**
 * Live personal annotations of one song for the signed-in user (roadmap #3).
 * The document id is carried along so a fresh snapshot can be told apart from
 * a stale one when the reader steps to the next song.
 */
export interface AnnotationsSnapshot extends SongAnnotation {
  songId: string
}

/** The document currently in state, tagged with the owner/song it came from. */
interface AnnotationsEntry {
  key: string
  value: AnnotationsSnapshot
}

/** Live personal notes of one song; empty until the document is read. */
export const useAnnotations = (
  uid: string | null,
  songId: string | null,
): AnnotationsSnapshot | null => {
  const [entry, setEntry] = useState<AnnotationsEntry | null>(null)
  const key = uid && songId ? `${uid}/${songId}` : null

  useEffect(() => {
    if (!key || !uid || !songId) return undefined
    return subscribeAnnotations(uid, songId, (annotation) => {
      setEntry({ key, value: { songId, ...annotation } })
    })
  }, [key, uid, songId])

  // A document from another song can still be in state for a commit after the
  // reader steps on: reading it as "not loaded yet" avoids showing the previous
  // song's notes against the new one.
  return entry && entry.key === key ? entry.value : null
}