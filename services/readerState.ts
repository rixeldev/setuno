import {
  doc,
  firestore,
  mapDoc,
  onSnapshot,
  paths,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "@/db/Fire"
import { clampReaderCapo, clampReaderFontSize, clampReaderSemitones, clampScrollRatio } from "@/libs/readerState"

/**
 * Personal reader state of one song, stored per user under
 * `users/{uid}/readerState/{songId}` (docs §22, roadmap #1/#4).
 *
 * It is private by design: reading preferences (autoscroll speed, resume
 * position and transpose) belong to the player, never to the band, and the
 * shared song document is never touched.
 */
export interface ReaderState {
  /** Autoscroll speed, in lyric lines per minute. */
  autoscrollSpeed?: number
  /** Seconds of countdown before autoscroll starts moving. */
  autoscrollDelay?: number
  /** Where the reader stopped, as 0..1 of the scrollable range (#4). */
  scrollRatio?: number
  /** Transposition the reader picked for this song (#4). */
  semitones?: number
  /** Capo the reader picked for this song (#4). */
  capo?: number
  /** Text size the reader picked for this song (#5); falls back to the profile. */
  fontSize?: number
}

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

/**
 * Reads a document back, clamped to the ranges the security rules accept. A
 * value edited into the database by hand can never push the reader out of
 * bounds.
 */
const mapReaderState = (data: DocumentData): ReaderState => {
  const mapped: ReaderState = {
    autoscrollSpeed: numberOrUndefined(data.autoscrollSpeed),
    autoscrollDelay: numberOrUndefined(data.autoscrollDelay),
  }
  if (numberOrUndefined(data.scrollRatio) !== undefined) {
    mapped.scrollRatio = clampScrollRatio(data.scrollRatio)
  }
  if (numberOrUndefined(data.semitones) !== undefined) {
    mapped.semitones = clampReaderSemitones(data.semitones)
  }
  if (numberOrUndefined(data.capo) !== undefined) {
    mapped.capo = clampReaderCapo(data.capo)
  }
  if (numberOrUndefined(data.fontSize) !== undefined) {
    mapped.fontSize = clampReaderFontSize(data.fontSize)
  }
  return mapped
}

/** Live personal state of one song for one user. */
export const subscribeReaderState = (
  uid: string,
  songId: string,
  onChange: (state: ReaderState | null) => void,
): Unsubscribe =>
  onSnapshot(
    doc(firestore, paths.userReaderState(uid, songId)),
    (snapshot) => onChange(mapDoc(snapshot, mapReaderState)),
    () => onChange(null),
  )

/**
 * Merges a patch into this user's state for a song. Offline-first: Firestore
 * queues the write and replays it when the connection returns.
 *
 * Only known fields are written, so the document always matches the keys the
 * security rules allow (see `firestore.rules`, `users/{uid}/readerState`), and
 * every value is clamped before it leaves the app.
 */
export const saveReaderState = async (
  uid: string,
  songId: string,
  patch: ReaderState,
): Promise<void> => {
  const data: Record<string, number> = {}
  if (patch.autoscrollSpeed !== undefined) data.autoscrollSpeed = patch.autoscrollSpeed
  if (patch.autoscrollDelay !== undefined) data.autoscrollDelay = patch.autoscrollDelay
  if (patch.scrollRatio !== undefined) data.scrollRatio = clampScrollRatio(patch.scrollRatio)
  if (patch.semitones !== undefined) data.semitones = clampReaderSemitones(patch.semitones)
  if (patch.capo !== undefined) data.capo = clampReaderCapo(patch.capo)
  if (patch.fontSize !== undefined) data.fontSize = clampReaderFontSize(patch.fontSize)
  if (Object.keys(data).length === 0) return
  await setDoc(doc(firestore, paths.userReaderState(uid, songId)), data, { merge: true })
}
