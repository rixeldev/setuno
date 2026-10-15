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
import { clampGoalMinutes, MAX_BREAK_MINUTES, MAX_GOAL_MINUTES } from "@/libs/setlistDuration"

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
    // Documents written before #42 carry no goal, and 0 is exactly what
    // "no goal" means — so there is nothing to migrate.
    targetMinutes: typeof data.targetMinutes === "number" ? data.targetMinutes : 0,
    breakMinutes: typeof data.breakMinutes === "number" ? data.breakMinutes : 0,
    // Written before this field existed, so absence means "an ordinary list".
    template: data.template === true,
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
  /** Key each song will be played in, keyed by song id (defaults to the song's). */
  songKeys: Record<string, string> = {},
): SetlistSong[] =>
  songIds
    .map((songId, order) => {
      const song = library.get(songId)
      return {
        songId,
        title: song?.title ?? "Unknown song",
        artist: song?.artist ?? "",
        key: songKeys[songId] ?? song?.key ?? "",
        order,
      }
    })
    .filter((entry) => library.has(entry.songId))

/** Current play-key map of a setlist, ready to feed `buildSetlistSongs`. */
export const setlistSongKeys = (songs: readonly SetlistSong[]): Record<string, string> =>
  Object.fromEntries(songs.map((entry) => [entry.songId, entry.key]))

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
  const songIds = Array.from(new Set(input.songIds.filter((id) => id.length > 0)))
  const songKeys: Record<string, string> = {}
  for (const songId of songIds) {
    const key = input.songKeys?.[songId]?.trim()
    if (key) songKeys[songId] = key
  }
  return {
    name,
    description: input.description.trim(),
    date: input.date,
    notes: input.notes,
    songIds,
    // Clamped here, not validated: the goal is a number field, and a target
    // typed as "9999" becomes the bound rather than an error the band cannot
    // read past. 0 is kept as 0 — that is "no goal".
    targetMinutes: clampGoalMinutes(input.targetMinutes, MAX_GOAL_MINUTES),
    breakMinutes: clampGoalMinutes(input.breakMinutes, MAX_BREAK_MINUTES),
    songKeys,
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
  const songs = buildSetlistSongs(normalized.songIds, library, normalized.songKeys)
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
    template: false,
    targetMinutes: normalized.targetMinutes,
    breakMinutes: normalized.breakMinutes,
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
  const songs = buildSetlistSongs(normalized.songIds, library, normalized.songKeys)

  await updateDoc(doc(firestore, paths.setlist(organizationId, setlistId)), {
    name: normalized.name,
    description: normalized.description,
    date: normalized.date,
    notes: normalized.notes,
    songs,
    estimatedDurationSec: estimateSetlistDuration(songs, library),
    targetMinutes: normalized.targetMinutes,
    breakMinutes: normalized.breakMinutes,
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
    // The goal travels with the list: a copy of a 45-minute set is a
    // 45-minute set.
    targetMinutes: source.targetMinutes,
    breakMinutes: source.breakMinutes,
    template: source.template,
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

/**
 * Saves a copy of a setlist as a **template** (roadmap #41): a new document
 * flagged `template`, with the date cleared, because a template is for *any*
 * event rather than one day. The source is left exactly as it was — turning a
 * running order that an event is already using into a template would pull the
 * gig's list out from under it.
 */
export const saveSetlistAsTemplate = async (
  organizationId: string,
  setlistId: string,
  name: string,
  author: { id: string; name: string },
): Promise<string> => {
  const uid = requireUserId()
  const source = await fetchSetlist(organizationId, setlistId)
  if (!source) throw new ValidationError("That setlist no longer exists.")

  const trimmed = name.trim()
  const templateName = trimmed.length > 0 ? trimmed.slice(0, 80) : source.name.slice(0, 80)
  const reference = doc(collection(firestore, paths.setlists(organizationId)))
  const now = serverTimestamp()

  await setDoc(reference, {
    organizationId,
    name: templateName,
    description: source.description,
    date: null,
    notes: source.notes,
    songs: source.songs,
    estimatedDurationSec: source.estimatedDurationSec,
    // A template keeps the goal — "45-min set" is most of why it is one.
    targetMinutes: source.targetMinutes,
    breakMinutes: source.breakMinutes,
    template: true,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })

  void logActivity({
    organizationId,
    type: "setlist_created",
    message: `${author.name} saved "${templateName}" as a template`,
    actorId: uid,
    actorName: author.name,
    targetType: "setlist",
    targetId: reference.id,
  })

  return reference.id
}

/** Moves a setlist in or out of the templates section (roadmap #41). */
export const setSetlistTemplate = async (
  organizationId: string,
  setlistId: string,
  template: boolean,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const setlist = await fetchSetlist(organizationId, setlistId)
  if (!setlist) throw new ValidationError("That setlist no longer exists.")

  await updateDoc(doc(firestore, paths.setlist(organizationId, setlistId)), {
    template,
    updatedAt: serverTimestamp(),
  })

  void logActivity({
    organizationId,
    type: "setlist_updated",
    message: template ?
      `${actor.name} saved "${setlist.name}" as a template`
    : `${actor.name} removed "${setlist.name}" from templates`,
    actorId: uid,
    actorName: actor.name,
    targetType: "setlist",
    targetId: setlistId,
  })
}

/** Reorders the songs of a setlist (docs §14: songs must be reorderable). */
export const reorderSetlistSongs = async (
  organizationId: string,
  setlistId: string,
  songIds: string[],
  library: Map<string, Song>,
  songKeys: Record<string, string> = {},
): Promise<void> => {
  const songs = buildSetlistSongs(songIds, library, songKeys)
  await updateDoc(doc(firestore, paths.setlist(organizationId, setlistId)), {
    songs,
    estimatedDurationSec: estimateSetlistDuration(songs, library),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Sets the key one song will be played in inside a setlist (docs §20). Stored
 * on the setlist entry only — the songbook keeps its original key — and synced
 * to every member through the setlist listener.
 */
export const updateSetlistSongKey = async (
  organizationId: string,
  setlistId: string,
  songId: string,
  key: string,
): Promise<void> => {
  const setlist = await fetchSetlist(organizationId, setlistId)
  if (!setlist) throw new ValidationError("That setlist no longer exists.")
  const songs = setlist.songs.map((entry) =>
    entry.songId === songId ? { ...entry, key: key.trim() } : entry,
  )
  await updateDoc(doc(firestore, paths.setlist(organizationId, setlistId)), {
    songs,
    updatedAt: serverTimestamp(),
  })
}