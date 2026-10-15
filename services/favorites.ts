import {
  collection,
  deleteDoc,
  doc,
  firestore,
  mapDocs,
  onSnapshot,
  paths,
  setDoc,
  type Unsubscribe,
} from "@/db/Fire"

/**
 * Personal favorites (roadmap #33): one tiny document per starred song at
 * `users/{uid}/favorites/{songId}` — the same per-song shape as readerState
 * and annotations, owner-only, and the shared song document is never touched.
 * The doc id *is* the song id, so the set is built from ids and a malformed
 * body can never point it somewhere else. Toggling is a plain create/delete,
 * so two devices starring at once cannot clobber each other.
 */
export const subscribeFavorites = (
  uid: string,
  onChange: (songIds: string[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!uid) return () => undefined
  return onSnapshot(
    collection(firestore, paths.userFavorites(uid)),
    (snapshot) => onChange(mapDocs(snapshot, (_data, id) => id)),
    (error) => onError?.(error),
  )
}

/** Stars or unstars a song for this user. */
export const setFavoriteSong = async (
  uid: string,
  songId: string,
  favorite: boolean,
): Promise<void> => {
  if (!uid || !songId) return
  const reference = doc(firestore, paths.userFavorite(uid, songId))
  if (favorite) await setDoc(reference, { songId })
  else await deleteDoc(reference)
}
