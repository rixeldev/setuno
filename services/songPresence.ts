import {
  collection,
  deleteDoc,
  doc,
  firestore,
  getDocs,
  onSnapshot,
  paths,
  setDoc,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import { mapPresence } from "@/libs/editPresence"
import type { SongPresence } from "@/interfaces"

/**
 * Refresh this editor's dot (roadmap #28). Client time on purpose — the
 * freshness window is judged offline and a `serverTimestamp` reads null while
 * a write queues. Fire-and-forget like `logActivity`: a rejected heartbeat
 * only lets the notice go quiet, it never touches the edit.
 */
export const touchSongPresence = async (
  organizationId: string,
  songId: string,
  uid: string,
  displayName: string,
): Promise<void> => {
  await setDoc(doc(firestore, paths.songPresence(organizationId, songId), uid), {
    uid,
    displayName,
    updatedAt: new Date(),
  })
}

/**
 * Retire the dot on the way out. Deleting a document that is already gone is
 * a no-op, and Firestore replays the queue in order, so an offline editor
 * whose touch and clear both queued still ends up clean.
 */
export const clearSongPresence = async (
  organizationId: string,
  songId: string,
  uid: string,
): Promise<void> => {
  await deleteDoc(doc(firestore, paths.songPresence(organizationId, songId), uid))
}

/**
 * Cascade for the hard delete (Firestore does not cascade subcollections —
 * the `deleteVersions` precedent): every dot under a purged song goes with it.
 * A live editor's heartbeat can only ever recreate one for a song that is
 * already open, and their own `clearSongPresence` retires it on the way out.
 */
export const deleteSongPresence = async (
  organizationId: string,
  songId: string,
): Promise<void> => {
  const snapshot = await getDocs(
    collection(firestore, paths.songPresence(organizationId, songId)),
  )
  for (const entry of snapshot.docs) {
    await deleteDoc(entry.ref)
  }
}

/** Every dot on one song, self-healed through `mapPresence`. */
export const subscribeSongPresence = (
  organizationId: string | null,
  songId: string | null,
  onChange: (editors: SongPresence[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId || !songId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    collection(firestore, paths.songPresence(organizationId, songId)),
    (snapshot) => {
      const editors: SongPresence[] = []
      for (const entry of snapshot.docs) {
        const mapped = mapPresence(entry.id, entry.data())
        if (mapped !== null) editors.push(mapped)
      }
      onChange(editors)
    },
    (error) => onError?.(error),
  )
}
