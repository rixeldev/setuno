import {
  doc,
  firestore,
  mapDoc,
  onSnapshot,
  paths,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "@/db/Fire"
import {
  EMPTY_ANNOTATION,
  annotationFromData,
  clampAnnotationNotes,
  clampMarkerText,
} from "@/libs/annotations"
import type { AnnotationMarker, SongAnnotation } from "@/interfaces"

/**
 * Personal annotations of one song for one user (roadmap #3), stored under
 * `users/{uid}/annotations/{songId}` — owner-only rules, never the shared song
 * document. The reader renders them as inline markers plus an end-of-song notes
 * block.
 */
const mapAnnotation = (data: DocumentData): SongAnnotation =>
  annotationFromData(data as Record<string, unknown>)

/** Live personal notes of one song for one user. */
export const subscribeAnnotations = (
  uid: string,
  songId: string,
  onChange: (annotation: SongAnnotation) => void,
): Unsubscribe =>
  onSnapshot(
    doc(firestore, paths.userAnnotation(uid, songId)),
    (snapshot) => onChange(mapDoc(snapshot, mapAnnotation) ?? EMPTY_ANNOTATION),
    () => onChange(EMPTY_ANNOTATION),
  )

/**
 * Merges a patch into this user's annotation document. Offline-first: Firestore
 * queues the write and replays it when the connection returns.
 *
 * Only known fields are written and every value is clamped to what the rules
 * accept (see `firestore.rules`, `users/{uid}/annotations`).
 */
export const saveAnnotations = async (
  uid: string,
  songId: string,
  patch: { notes?: string; markers?: AnnotationMarker[] },
): Promise<void> => {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (patch.notes !== undefined) data.notes = clampAnnotationNotes(patch.notes)
  if (patch.markers !== undefined) {
    data.markers = patch.markers.map((marker) => ({
      id: marker.id,
      sectionId: marker.sectionId,
      lineIndex: marker.lineIndex,
      text: clampMarkerText(marker.text),
    }))
  }
  await setDoc(doc(firestore, paths.userAnnotation(uid, songId)), data, { merge: true })
}