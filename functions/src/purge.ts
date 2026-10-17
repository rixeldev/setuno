import type { Firestore } from "firebase-admin/firestore"

/**
 * The scheduled half of the song trash (roadmap #31, shipped with the Cloud
 * Functions workspace of roadmap P0.1). A trashed song stays 30 days in the
 * trash — restorable the whole time — and this purge then deletes it **for
 * good**, with the same cascade as the trash's "Delete forever"
 * (`services/songs.ts#purgeSong`): the document and its `versions` history,
 * because Firestore never cascades. The per-user documents keyed by the song
 * id (annotations, reader state, favorites) stay behind on purpose, exactly
 * like a manual purge: the owner-only rules make them unreachable anyway.
 *
 * The Admin SDK bypasses the security rules, so this needs no rules change.
 * Every decision that can be made without a database lives here as a plain
 * function; the scheduled wrapper in `index.ts` is a thin shell over this.
 */
export const TRASH_TTL_DAYS = 30

/** One run never processes more songs than this; the rest wait for tomorrow. */
const SONGS_PER_RUN = 500

/** Firestore batches cap at 500 writes — stay under with headroom. */
const WRITES_PER_BATCH = 400

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000

/** A song trashed before this instant has expired. */
export const expiredBefore = (now: Date): Date =>
  new Date(now.getTime() - TRASH_TTL_DAYS * MILLIS_PER_DAY)

/** Splits a list into runs of `size`; the last run may be shorter. */
export const chunksOf = <T>(items: readonly T[], size: number): T[][] => {
  const step = Math.max(1, Math.floor(size))
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += step) {
    chunks.push(items.slice(start, start + step))
  }
  return chunks
}

export interface PurgeResult {
  songs: number
  versions: number
}

/**
 * Deletes every song whose `deletedAt` is older than the TTL, together with
 * its version history, and reports what went. `deletedAt` is the only field
 * this query touches and it rides Firestore's automatic collection-group
 * single-field index, so no index ships with it. The two range filters on the
 * same field are what spare a live song in **both** shapes it exists in: the
 * field missing, and the explicit `null` that `restoreSong` writes — `null`
 * orders before every timestamp, so an upper bound alone would match it. The
 * integration suite pins that behaviour against the emulator.
 */
export const purgeExpiredSongs = async (db: Firestore, now: Date): Promise<PurgeResult> => {
  const snapshot = await db
    .collectionGroup("songs")
    .where("deletedAt", ">", new Date(0))
    .where("deletedAt", "<", expiredBefore(now))
    .limit(SONGS_PER_RUN)
    .get()
  let songs = 0
  let versions = 0
  for (const song of snapshot.docs) {
    const versionDocs = await song.ref.collection("versions").listDocuments()
    // The song document rides the last batch of its own versions.
    for (const group of chunksOf([...versionDocs, song.ref], WRITES_PER_BATCH)) {
      const batch = db.batch()
      for (const target of group) batch.delete(target)
      await batch.commit()
    }
    songs += 1
    versions += versionDocs.length
  }
  return { songs, versions }
}
