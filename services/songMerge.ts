import {
  collection,
  doc,
  firestore,
  getDoc,
  getDocs,
  paths,
  query,
  requireUserId,
  serverTimestamp,
  where,
  writeBatch,
} from "@/db/Fire"
import { logActivity } from "@/services/activity"
import { buildSetlistSongs, estimateSetlistDuration, fetchSetlists } from "@/services/setlists"
import { fetchSong, fetchSongs } from "@/services/songs"
import { ValidationError } from "@/services/errors"
import {
  annotationSnapshot,
  mergeAnnotationDocs,
  readerStateCopy,
  repointSetlist,
} from "@/libs/songMerge"

/** What a merge actually moved — printed by the caller and handy in tests. */
export interface MergeOutcome {
  setlists: number
  suggestions: number
}

/**
 * Folds `loserId` into `masterId` and deletes the loser (roadmap #32).
 *
 * Everything non-destructive happens first and lands in **one batch**: the
 * acting user's own annotations/reader state are combined or moved, every
 * affected setlist is repointed (entries, play keys, entry notes, dividers,
 * duration) and the loser's suggestions follow the song. Only after that batch
 * commits is anything irreversible — so a failure mid-way leaves the loser
 * alive and the operation safely re-runnable: every step is idempotent (a
 * re-pointed setlist no longer references the loser, a moved document no longer
 * exists under the loser id).
 *
 * No per-setlist activity spam: the single `song_merged` event below tells the
 * whole story. Other members' personal documents are unreachable by design
 * (owner-only rules) and stay under the old song id — documented in AGENTS.md
 * rather than worked around.
 */
export const mergeSongs = async (
  organizationId: string,
  { masterId, loserId }: { masterId: string; loserId: string },
  actor: { id: string; name: string },
): Promise<MergeOutcome> => {
  const uid = requireUserId()
  if (masterId === loserId) {
    throw new ValidationError("Pick a different song to merge with.", "songId")
  }

  const [master, loser] = await Promise.all([
    fetchSong(organizationId, masterId),
    fetchSong(organizationId, loserId),
  ])
  if (!master) throw new ValidationError("The song to keep was not found.", "songId")
  if (!loser) throw new ValidationError("The song to merge was not found.", "songId")

  const [songs, setlists, suggestionSnapshot] = await Promise.all([
    fetchSongs(organizationId),
    fetchSetlists(organizationId),
    getDocs(
      query(
        collection(firestore, paths.suggestions(organizationId)),
        where("songId", "==", loserId),
      ),
    ),
  ])
  const suggestionIds = suggestionSnapshot.docs.map((snapshot) => snapshot.id)

  // --- the acting user's own per-song documents (read first, written below) ---
  const annotationRefs = {
    master: doc(firestore, paths.userAnnotation(uid, masterId)),
    loser: doc(firestore, paths.userAnnotation(uid, loserId)),
  }
  const stateRefs = {
    master: doc(firestore, paths.userReaderState(uid, masterId)),
    loser: doc(firestore, paths.userReaderState(uid, loserId)),
  }
  const [masterAnnotationSnap, loserAnnotationSnap, masterStateSnap, loserStateSnap] =
    await Promise.all([
      getDoc(annotationRefs.master),
      getDoc(annotationRefs.loser),
      getDoc(stateRefs.master),
      getDoc(stateRefs.loser),
    ])

  const annotation = mergeAnnotationDocs(
    masterAnnotationSnap.exists() ? annotationSnapshot(masterAnnotationSnap.data() ?? {}) : null,
    loserAnnotationSnap.exists() ? annotationSnapshot(loserAnnotationSnap.data() ?? {}) : null,
  )

  // --- one batch: every re-point, the personal copies, then the deletion ---
  const batch = writeBatch(firestore)
  const library = new Map(songs.map((song) => [song.id, song]))

  let setlistsTouched = 0
  for (const setlist of setlists) {
    const plan = repointSetlist(setlist, loserId, masterId)
    if (!plan.changed) continue
    const rebuilt = buildSetlistSongs(plan.songIds, library, plan.songKeys, plan.songNotes)
    batch.update(doc(firestore, paths.setlist(organizationId, setlist.id)), {
      songs: rebuilt,
      blocks: plan.blocks,
      estimatedDurationSec: estimateSetlistDuration(rebuilt, library),
      updatedAt: serverTimestamp(),
    })
    setlistsTouched++
  }

  for (const suggestionId of suggestionIds) {
    batch.update(doc(firestore, paths.suggestion(organizationId, suggestionId)), {
      songId: masterId,
      songTitle: master.title,
    })
  }

  if (annotation.merged) {
    batch.set(annotationRefs.master, {
      notes: annotation.merged.notes,
      markers: annotation.merged.markers,
      updatedAt: serverTimestamp(),
    })
    // `complete: false` means the combined document could not hold everything:
    // keep the loser's own document rather than destroy content we did not copy.
    if (annotation.complete) batch.delete(annotationRefs.loser)
  }

  if (loserStateSnap.exists()) {
    const copied = readerStateCopy(loserStateSnap.data() ?? {})
    // The master's own state (font, transpose, resume point) wins when it has
    // one; otherwise the reader's settings follow the music over.
    if (!masterStateSnap.exists() && Object.keys(copied).length > 0) {
      batch.set(stateRefs.master, copied)
    }
    batch.delete(stateRefs.loser)
  }

  batch.delete(doc(firestore, paths.song(organizationId, loserId)))
  await batch.commit()

  void logActivity({
    organizationId,
    type: "song_merged",
    message: `${actor.name} merged "${loser.title}" into "${master.title}"`,
    actorId: uid,
    actorName: actor.name,
    targetType: "song",
    targetId: masterId,
  })

  return { setlists: setlistsTouched, suggestions: suggestionIds.length }
}
