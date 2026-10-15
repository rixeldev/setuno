import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  firestore,
  getDoc,
  mapDoc,
  mapDocs,
  onSnapshot,
  orderBy,
  paths,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "@/db/Fire"
import type { UserCollection } from "@/interfaces"
import type { TimestampLike } from "@/interfaces/timestamp"
import { collectionName, sanitizeSongIds, MAX_COLLECTION_SONGS } from "@/libs/personalCollections"
import { ValidationError } from "@/services/errors"

const mapCollection = (data: Record<string, unknown>, id: string): UserCollection => ({
  id,
  // Invalid stored data self-heals as "no name"; the UI shows its own
  // placeholder rather than the document inventing copy.
  name: collectionName(data.name) ?? "",
  songIds: sanitizeSongIds(data.songIds, MAX_COLLECTION_SONGS),
  createdAt: (data.createdAt as TimestampLike | null) ?? null,
  updatedAt: (data.updatedAt as TimestampLike | null) ?? null,
})

/**
 * Private collections of one user (roadmap #33) — personal setlist drafts,
 * never visible to other members. Recently touched first, which is the order a
 * draft shelf wants.
 */
export const subscribeCollections = (
  uid: string,
  onChange: (collections: UserCollection[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!uid) return () => undefined
  return onSnapshot(
    query(collection(firestore, paths.userCollections(uid)), orderBy("updatedAt", "desc")),
    (snapshot) => onChange(mapDocs(snapshot, mapCollection)),
    (error) => onError?.(error),
  )
}

/** One collection, for the "new setlist from collection" hand-off. */
export const fetchCollection = async (
  uid: string,
  collectionId: string,
): Promise<UserCollection | null> => {
  if (!uid || !collectionId) return null
  const snapshot = await getDoc(doc(firestore, paths.userCollection(uid, collectionId)))
  return mapDoc(snapshot, mapCollection)
}

/** The rules reject an empty or oversized name, so the client asks instead. */
const nameOrThrow = (name: string): string => {
  const clean = collectionName(name)
  if (!clean) throw new ValidationError("A collection name is required.", "name")
  return clean
}

export const createCollection = async (
  uid: string,
  name: string,
  songIds: string[] = [],
): Promise<string> => {
  const clean = nameOrThrow(name)
  const now = new Date()
  const reference = doc(collection(firestore, paths.userCollections(uid)))
  await setDoc(reference, {
    name: clean,
    songIds: sanitizeSongIds(songIds, MAX_COLLECTION_SONGS),
    createdAt: now,
    updatedAt: now,
  })
  return reference.id
}

export const renameCollection = async (
  uid: string,
  collectionId: string,
  name: string,
): Promise<void> => {
  const clean = nameOrThrow(name)
  await updateDoc(doc(firestore, paths.userCollection(uid, collectionId)), {
    name: clean,
    updatedAt: new Date(),
  })
}

export const deleteCollection = async (uid: string, collectionId: string): Promise<void> => {
  await deleteDoc(doc(firestore, paths.userCollection(uid, collectionId)))
}

export const addSongsToCollection = async (
  uid: string,
  collectionId: string,
  songIds: string[],
): Promise<void> => {
  const ids = sanitizeSongIds(songIds, MAX_COLLECTION_SONGS)
  if (ids.length === 0) return
  await updateDoc(doc(firestore, paths.userCollection(uid, collectionId)), {
    songIds: arrayUnion(...ids),
    updatedAt: new Date(),
  })
}

export const removeSongFromCollection = async (
  uid: string,
  collectionId: string,
  songId: string,
): Promise<void> => {
  await updateDoc(doc(firestore, paths.userCollection(uid, collectionId)), {
    songIds: arrayRemove(songId),
    updatedAt: new Date(),
  })
}
