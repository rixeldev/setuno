import {
  collection,
  deleteDoc,
  doc,
  firestore,
  getDoc,
  getDocs,
  limitTo,
  mapDoc,
  mapDocs,
  onSnapshot,
  orderBy,
  paths,
  query,
  requireUserId,
  serverTimestamp,
  setDoc,
  updateDoc,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import type { Setlist, SetlistInput, SetlistSong, Song } from "@/interfaces"
import { logActivity } from "@/services/activity"
import { ValidationError } from "@/services/errors"
import { estimateDurationSec } from "@/libs/songUtils"

const mapSetlist = (data: Record<string, unknown>, id: string): Setlist => {
  const songs = Array.isArray(data.songs)
    ? (data.songs as unknown[])
        .map((entry, index) => {
          const song = (entry ?? {}) as Partial<SetlistSong>
          return {
            songId: String(song.songId ?? ""),
            title: String(song.title ?? ""),
            artist: String(song.artist ?? ""),
            key: String(song.key ?? ""),
            order: typeof song.order === "number" ? song.order : index,
          }
        })
        .filter((entry) => entry.songId.length > 0)
        .sort((a, b) => a.order - b.order)
    : []

  return {
    id,
    organizationId: String(data.organizationId ?? ""),
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    date: (data.date as string | null) ?? null,
    notes: String(data.notes ?? ""),
    songs,
    estimatedDurationSec:
      typeof data.estimatedDurationSec === "number" ? data.estimatedDurationSec : 0,
    createdBy: String(data.createdBy ?? ""),
    createdAt: data.createdAt as Setlist["createdAt"],
    updatedAt: data.updatedAt as Setlist["updatedAt"],
  }
}

export const subscribeSetlists = (
  organizationId: string | null,
  onChange: (setlists: Setlist[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(collection(firestore, paths.setlists(organizationId)), orderBy("name"), limitTo(200)),
    (snapshot) => onChange(mapDocs(snapshot, mapSetlist)),
    // Keep whatever is on screen and let the caller show an error banner: a
    // dropped listener should not wipe the running order the band is reading.
    (error) => onError?.(error),
  )
}

export const fetchSetlist = async (
  organizationId: string,
  setlistId: string,
): Promise<Setlist | null> => {
  const snapshot = await getDoc(doc(firestore, paths.setlist(organizationId, setlistId)))
  return mapDoc(snapshot, mapSetlist)
}

export const fetchSetlists = async (organizationId: string): Promise<Setlist[]> => {
  const snapshot = await getDocs(
    query(collection(firestore, paths.setlists(organizationId)), orderBy("name"), limitTo(200)),
  )
  return mapDocs(snapshot, mapSetlist)
}

/** Turns a list of song ids into ordered setlist entries with cached titles. */
export const buildSetlistSongs = (
  songIds: string[],
  library: Map<string, Song>,
): SetlistSong[] =>
  songIds
    .map((songId, order) => {
      const song = library.get(songId)
      return {
        songId,
        title: song?.title ?? "Unknown song",
        artist: song?.artist ?? "",
        key: song?.key ?? "",
        order,
      }
    })
    .filter((entry) => library.has(entry.songId))

/** Sum of known song durations, falling back to a lyric-length estimate. */
export const estimateSetlistDuration = (songs: SetlistSong[], library: Map<string, Song>): number =>
  songs.reduce((total, entry) => {
    const song = library.get(entry.songId)
    if (!song) return total
    if (song.durationSec && song.durationSec > 0) return total + song.durationSec
    return total + estimateDurationSec(song.sections)
  }, 0)

const normalizeInput = (input: SetlistInput): SetlistInput => {
  const name = input.name.trim()
  if (name.length === 0) throw new ValidationError("Setlist name is required.", "name")
  if (name.length > 80) throw new ValidationError("Setlist name is too long.", "name")
  return {
    name,
    description: input.description.trim(),
    date: input.date,
    notes: input.notes,
    songIds: Array.from(new Set(input.songIds.filter((id) => id.length > 0))),
  }
}

export const createSetlist = async (
  organizationId: string,
  input: SetlistInput,
  library: Map<string, Song>,
  author: { id: string; name: string },
): Promise<string> => {
  const uid = requireUserId()
  const normalized = normalizeInput(input)
  const songs = buildSetlistSongs(normalized.songIds, library)
  const reference = doc(collection(firestore, paths.setlists(organizationId)))
  const now = serverTimestamp()

  await setDoc(reference, {
    organizationId,
    name: normalized.name,
    description: normalized.description,
    date: normalized.date,
    notes: normalized.notes,
    songs,
    estimatedDurationSec: estimateSetlistDuration(songs, library),
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })

  void logActivity({
    organizationId,
    type: "setlist_created",
    message: `${author.name} created "${normalized.name}"`,
    actorId: uid,
    actorName: author.name,
    targetType: "setlist",
    targetId: reference.id,
  })

  return reference.id
}

export const updateSetlist = async (
  organizationId: string,
  setlistId: string,
  input: SetlistInput,
  library: Map<string, Song>,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const normalized = normalizeInput(input)
  const songs = buildSetlistSongs(normalized.songIds, library)

  await updateDoc(doc(firestore, paths.setlist(organizationId, setlistId)), {
    name: normalized.name,
    description: normalized.description,
    date: normalized.date,
    notes: normalized.notes,
    songs,
    estimatedDurationSec: estimateSetlistDuration(songs, library),
    updatedAt: serverTimestamp(),
  })

  void logActivity({
    organizationId,
    type: "setlist_updated",
    message: `${actor.name} updated "${normalized.name}"`,
    actorId: uid,
    actorName: actor.name,
    targetType: "setlist",
    targetId: setlistId,
  })
}

export const deleteSetlist = async (
  organizationId: string,
  setlistId: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const setlist = await fetchSetlist(organizationId, setlistId)
  await deleteDoc(doc(firestore, paths.setlist(organizationId, setlistId)))

  void logActivity({
    organizationId,
    type: "setlist_deleted",
    message: `${actor.name} deleted "${setlist?.name ?? "a setlist"}"`,
    actorId: uid,
    actorName: actor.name,
    targetType: "setlist",
    targetId: setlistId,
  })
}

/** Copies a setlist (name, notes and song order) under a new name. */
export const duplicateSetlist = async (
  organizationId: string,
  setlistId: string,
  nameSuffix: string,
  author: { id: string; name: string },
): Promise<string> => {
  const uid = requireUserId()
  const source = await fetchSetlist(organizationId, setlistId)
  if (!source) throw new ValidationError("That setlist no longer exists.")

  const reference = doc(collection(firestore, paths.setlists(organizationId)))
  const now = serverTimestamp()
  const name = `${source.name}${nameSuffix}`.slice(0, 80)

  await setDoc(reference, {
    organizationId,
    name,
    description: source.description,
    date: source.date,
    notes: source.notes,
    songs: source.songs,
    estimatedDurationSec: source.estimatedDurationSec,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })

  void logActivity({
    organizationId,
    type: "setlist_created",
    message: `${author.name} duplicated "${source.name}"`,
    actorId: uid,
    actorName: author.name,
    targetType: "setlist",
    targetId: reference.id,
  })

  return reference.id
}

/** Reorders the songs of a setlist (docs §14: songs must be reorderable). */
export const reorderSetlistSongs = async (
  organizationId: string,
  setlistId: string,
  songIds: string[],
  library: Map<string, Song>,
): Promise<void> => {
  const songs = buildSetlistSongs(songIds, library)
  await updateDoc(doc(firestore, paths.setlist(organizationId, setlistId)), {
    songs,
    estimatedDurationSec: estimateSetlistDuration(songs, library),
    updatedAt: serverTimestamp(),
  })
}