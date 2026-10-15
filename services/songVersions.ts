import {
  collection,
  doc,
  firestore,
  getDocs,
  limitTo,
  mapDocs,
  orderBy,
  paths,
  query,
  setDoc,
  writeBatch,
} from "@/db/Fire"
import type { SongInput, SongVersion } from "@/interfaces"
import {
  SONG_VERSION_CAP,
  sortVersionsDesc,
  versionsToPrune,
} from "@/libs/songHistory"
import { mapSongInput } from "@/services/songs"

const versionCollection = (organizationId: string, songId: string) =>
  collection(firestore, paths.songVersions(organizationId, songId))

const mapSongVersion = (data: Record<string, unknown>, id: string): SongVersion => ({
  id,
  data: mapSongInput((data.data ?? {}) as Record<string, unknown>),
  savedAt: data.savedAt as SongVersion["savedAt"],
  savedBy: String(data.savedBy ?? ""),
  savedByName: String(data.savedByName ?? ""),
})

/**
 * The saved versions of one song, newest first (roadmap #26). One-shot on
 * purpose: history is reviewed, not watched, and the cap keeps the read at a
 * handful of documents.
 */
export const fetchVersions = async (
  organizationId: string,
  songId: string,
  cap: number = SONG_VERSION_CAP,
): Promise<SongVersion[]> => {
  const snapshot = await getDocs(
    query(versionCollection(organizationId, songId), orderBy("savedAt", "desc"), limitTo(cap)),
  )
  return sortVersionsDesc(mapDocs(snapshot, mapSongVersion))
}

/**
 * Keeps the state a save replaced, then prunes past the cap. Fire-and-forget
 * like `logActivity`: the save itself has already succeeded by the time this
 * runs, so a rejected version write must never surface as a failed save. It
 * needs the rules redeploy that ships with #26 to be allowed at all.
 */
export const writeVersion = async (
  organizationId: string,
  songId: string,
  data: SongInput,
  actor: { id: string; name: string },
): Promise<void> => {
  try {
    const reference = doc(versionCollection(organizationId, songId))
    await setDoc(reference, {
      data,
      // Client time on purpose: a server timestamp stays null while the
      // write is queued offline, and version order must survive an offline
      // save — the whole point of an offline-first app.
      savedAt: new Date(),
      savedBy: actor.id,
      savedByName: actor.name,
    })

    // Read back (pending writes included) and drop what fell past the cap.
    const versions = await fetchVersions(organizationId, songId, SONG_VERSION_CAP + 1)
    const prune = versionsToPrune(versions)
    if (prune.length === 0) return
    const batch = writeBatch(firestore)
    for (const id of prune) {
      batch.delete(doc(versionCollection(organizationId, songId), id))
    }
    await batch.commit()
  } catch {
    // Best-effort history: a missing entry is not worth failing a save over.
  }
}

/**
 * Removes a song's whole history — its song is going away (delete or merge),
 * and Firestore does not cascade subcollections. Best-effort cleanup.
 */
export const deleteVersions = async (organizationId: string, songId: string): Promise<void> => {
  try {
    // The write side caps a song's history, so one batch covers it.
    const versions = await fetchVersions(organizationId, songId, SONG_VERSION_CAP + 5)
    if (versions.length === 0) return
    const batch = writeBatch(firestore)
    for (const version of versions) {
      batch.delete(doc(versionCollection(organizationId, songId), version.id))
    }
    await batch.commit()
  } catch {
    // Best-effort cleanup: leftover documents are unreachable either way.
  }
}
