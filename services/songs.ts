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
import type { LyricLine, Song, SongInput, SongSection } from "@/interfaces"
import { logActivity } from "@/services/activity"
import { deleteSongPresence } from "@/services/songPresence"
import { deleteVersions, writeVersion } from "@/services/songVersions"
import { ValidationError } from "@/services/errors"
import { countSongChords, countSongLines, clampSectionBars, normalizeSectionLabels } from "@/libs/songUtils"
import { songVersionData } from "@/libs/songHistory"
import { normalizeSongStatus } from "@/libs/songStatus"
import { normalizeSongLinks } from "@/libs/songLinks"
import { duplicateSongTitle } from "@/libs/songMerge"

const mapChords = (raw: unknown): LyricLine["chords"] => {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const chord = entry as { chord?: unknown; position?: unknown }
      const chordName = typeof chord.chord === "string" ? chord.chord.trim() : ""
      const position = typeof chord.position === "number" ? chord.position : Number.NaN
      if (chordName.length === 0 || Number.isNaN(position)) return null
      return { chord: chordName, position }
    })
    .filter((entry): entry is LyricLine["chords"][number] => entry !== null)
}

const mapSections = (raw: unknown): SongSection[] => {
  if (!Array.isArray(raw)) return []
  return raw.map((entry, index) => {
    const section = (entry ?? {}) as Partial<SongSection>
    const lines = Array.isArray(section.lines) ? section.lines : []
    const bars = typeof section.bars === "number" ? clampSectionBars(section.bars) : 0
    return {
      id: typeof section.id === "string" && section.id.length > 0 ? section.id : `sec_${index}`,
      type: (section.type ?? "verse") as SongSection["type"],
      label: typeof section.label === "string" && section.label.length > 0 ? section.label : "Section",
      ...(bars > 0 ? { bars } : {}),
      lines: lines.map((line) => {
        const value = (line ?? {}) as Partial<LyricLine>
        return {
          text: typeof value.text === "string" ? value.text : "",
          chords: mapChords(value.chords),
        }
      }),
    }
  })
}

/**
 * The editable content of a song as stored — shared by the song reader and,
 * since roadmap #26, by version documents, so both normalise identically.
 */
export const mapSongInput = (data: Record<string, unknown>): SongInput => ({
  title: String(data.title ?? ""),
  artist: String(data.artist ?? ""),
  key: String(data.key ?? ""),
  originalKey: String(data.originalKey ?? data.key ?? ""),
  capo: typeof data.capo === "number" ? data.capo : 0,
  bpm: typeof data.bpm === "number" ? data.bpm : null,
  durationSec: typeof data.durationSec === "number" ? data.durationSec : null,
  genre: String(data.genre ?? ""),
  notes: String(data.notes ?? ""),
  tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
  sections: mapSections(data.sections),
  links: normalizeSongLinks(data.links),
  // Absence (a document written before #30) reads back as active — no migration.
  status: normalizeSongStatus(data.status),
})

const mapSong = (data: Record<string, unknown>, id: string): Song =>
  ({
    id,
    organizationId: String(data.organizationId ?? ""),
    ...mapSongInput(data),
    // Trash (roadmap #31): absent or null = live.
    deletedAt: (data.deletedAt as Song["deletedAt"]) ?? null,
    deletedBy: data.deletedBy ? String(data.deletedBy) : null,
    createdBy: String(data.createdBy ?? ""),
    createdByName: String(data.createdByName ?? ""),
    createdAt: data.createdAt as Song["createdAt"],
    updatedAt: data.updatedAt as Song["updatedAt"],
  }) as Song

/** Validates and normalises admin input before writing. */
export const normalizeSongInput = (input: SongInput): SongInput => {
  const title = input.title.trim()
  if (title.length === 0) throw new ValidationError("Song title is required.", "title")
  if (title.length > 120) throw new ValidationError("Song title is too long.", "title")

  const sections = normalizeSectionLabels(
    input.sections.map(({ bars, ...section }) => ({
      ...section,
      id: section.id && section.id.length > 0 ? section.id : `sec_${Math.random().toString(36).slice(2, 9)}`,
      label: section.label.trim().length > 0 ? section.label.trim() : "Section",
      ...(bars && bars > 0 ? { bars: clampSectionBars(bars) } : {}),
      lines: section.lines.map((line) => ({
        text: line.text,
        chords: line.chords
          .filter((chord) => chord.chord.trim().length > 0)
          .map((chord) => ({ chord: chord.chord.trim(), position: Math.max(0, Math.round(chord.position)) }))
          .sort((a, b) => a.position - b.position),
      })),
    })),
  )

  return {
    title,
    artist: input.artist.trim(),
    key: input.key.trim(),
    originalKey: (input.originalKey.trim() || input.key.trim()),
    capo: Math.max(0, Math.min(12, Math.round(input.capo))),
    bpm: input.bpm,
    durationSec: input.durationSec,
    genre: input.genre.trim(),
    notes: input.notes,
    tags: Array.from(new Set(input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12),
    sections,
    links: normalizeSongLinks(input.links),
    status: normalizeSongStatus(input.status),
  }
}

/** Live song list for an organization (newest first). */
export const subscribeSongs = (
  organizationId: string | null,
  onChange: (songs: Song[]) => void,
  options: { limit?: number; onError?: SubscribeErrorHandler } = {},
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(
      collection(firestore, paths.songs(organizationId)),
      orderBy("title"),
      limitTo(options.limit ?? 500),
    ),
    (snapshot) => onChange(mapDocs(snapshot, mapSong)),
    // Keep the last good list and let the caller show an error banner.
    (error) => options.onError?.(error),
  )
}

export const fetchSongs = async (organizationId: string): Promise<Song[]> => {
  const snapshot = await getDocs(
    query(collection(firestore, paths.songs(organizationId)), orderBy("title"), limitTo(500)),
  )
  return mapDocs(snapshot, mapSong)
}

export const fetchSong = async (
  organizationId: string,
  songId: string,
): Promise<Song | null> => {
  const snapshot = await getDoc(doc(firestore, paths.song(organizationId, songId)))
  return mapDoc(snapshot, mapSong)
}

/** Live single-song updates (used by the reader and the editor). */
export const subscribeSong = (
  organizationId: string | null,
  songId: string | null,
  onChange: (song: Song | null) => void,
): Unsubscribe => {
  if (!organizationId || !songId) {
    onChange(null)
    return () => undefined
  }
  return onSnapshot(
    doc(firestore, paths.song(organizationId, songId)),
    (snapshot) => onChange(mapDoc(snapshot, mapSong)),
    () => onChange(null),
  )
}

export const createSong = async (
  organizationId: string,
  input: SongInput,
  author: { id: string; name: string },
): Promise<string> => {
  const uid = requireUserId()
  const normalized = normalizeSongInput(input)
  const reference = doc(collection(firestore, paths.songs(organizationId)))
  const now = serverTimestamp()

  await setDoc(reference, {
    ...normalized,
    organizationId,
    createdBy: uid,
    createdByName: author.name,
    createdAt: now,
    updatedAt: now,
  })

  void logActivity({
    organizationId,
    type: "song_created",
    message: `${author.name} added "${normalized.title}"`,
    actorId: uid,
    actorName: author.name,
    targetType: "song",
    targetId: reference.id,
  })

  return reference.id
}

export const updateSong = async (
  organizationId: string,
  songId: string,
  input: SongInput,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const normalized = normalizeSongInput(input)
  // The version keeps the state this save replaces (roadmap #26), so the
  // history reads as the list of states the song has been — and a restore,
  // which is itself an update, versions the current state first for free.
  const previous = await fetchSong(organizationId, songId)
  await updateDoc(doc(firestore, paths.song(organizationId, songId)), {
    ...normalized,
    updatedAt: serverTimestamp(),
  })

  if (previous) {
    void writeVersion(organizationId, songId, songVersionData(previous), {
      id: uid,
      name: actor.name,
    })
  }

  void logActivity({
    organizationId,
    type: "song_updated",
    message: `${actor.name} updated "${normalized.title}"`,
    actorId: uid,
    actorName: actor.name,
    targetType: "song",
    targetId: songId,
  })
}

/**
 * A copy of an existing song under a fresh id (roadmap #32) — the start of a
 * variant. Sections keep their ids on purpose: a duplicate is the same music,
 * so private annotations anchored to those sections stay valid on both songs.
 * The `suffix` comes localized from the caller (`" (copy)"` / `" (copia)"`),
 * same as `duplicateSetlist`.
 */
export const duplicateSong = async (
  organizationId: string,
  songId: string,
  suffix: string,
  author: { id: string; name: string },
): Promise<string> => {
  const uid = requireUserId()
  const source = await fetchSong(organizationId, songId)
  if (!source) throw new ValidationError("Song not found.", "songId")

  const reference = doc(collection(firestore, paths.songs(organizationId)))
  const now = serverTimestamp()
  const title = duplicateSongTitle(source.title, suffix)

  await setDoc(reference, {
    organizationId,
    title,
    artist: source.artist,
    key: source.key,
    originalKey: source.originalKey,
    capo: source.capo,
    bpm: source.bpm,
    durationSec: source.durationSec,
    genre: source.genre,
    notes: source.notes,
    tags: source.tags,
    sections: source.sections,
    links: source.links,
    status: source.status,
    createdBy: uid,
    createdByName: author.name,
    createdAt: now,
    updatedAt: now,
  })

  void logActivity({
    organizationId,
    type: "song_duplicated",
    message: `${author.name} duplicated "${source.title}"`,
    actorId: uid,
    actorName: author.name,
    targetType: "song",
    targetId: reference.id,
  })

  return reference.id
}

/**
 * Soft delete (roadmap #31): the band's "delete" is a move to the trash — the
 * document stays with who trashed it and when, and every screen derives "gone"
 * from those two fields. Stamped with **client** time, exactly like a version's
 * `savedAt`: a `serverTimestamp` is null while an offline write queues, and a
 * trashed song must vanish from the songbook immediately, not when the queue
 * flushes. Not an edit, so no version is written and `updatedAt` is untouched.
 */
export const trashSong = async (
  organizationId: string,
  songId: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const song = await fetchSong(organizationId, songId)
  await updateDoc(doc(firestore, paths.song(organizationId, songId)), {
    deletedAt: new Date(),
    deletedBy: uid,
  })

  void logActivity({
    organizationId,
    type: "song_trashed",
    message: `${actor.name} moved "${song?.title ?? "a song"}" to the trash`,
    actorId: uid,
    actorName: actor.name,
    targetType: "song",
    targetId: songId,
  })
}

/** Puts a trashed song back into circulation (roadmap #31). */
export const restoreSong = async (
  organizationId: string,
  songId: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const song = await fetchSong(organizationId, songId)
  // `null` rather than removing the keys: `diff().affectedKeys()` reports both
  // the same way, and one shape is easier to reason about offline.
  await updateDoc(doc(firestore, paths.song(organizationId, songId)), {
    deletedAt: null,
    deletedBy: null,
  })

  void logActivity({
    organizationId,
    type: "song_restored",
    message: `${actor.name} restored "${song?.title ?? "a song"}"`,
    actorId: uid,
    actorName: actor.name,
    targetType: "song",
    targetId: songId,
  })
}

/**
 * The **hard** delete (roadmap #31): the document and its version history are
 * gone for good. Songs leave the band through `trashSong` — this is only the
 * trash's "delete forever" and a merge's loser, which must not linger.
 */
export const purgeSong = async (
  organizationId: string,
  songId: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const song = await fetchSong(organizationId, songId)
  await deleteDocFor(organizationId, songId)
  // Firestore does not cascade: the song's version history goes with it
  // (roadmap #26) and so do its edit-presence dots (roadmap #28),
  // best-effort like the activity log below.
  void deleteVersions(organizationId, songId)
  void deleteSongPresence(organizationId, songId)

  void logActivity({
    organizationId,
    type: "song_deleted",
    message: `${actor.name} deleted "${song?.title ?? "a song"}"`,
    actorId: uid,
    actorName: actor.name,
    targetType: "song",
    targetId: songId,
  })
}

const deleteDocFor = async (organizationId: string, songId: string): Promise<void> => {
  await deleteDoc(doc(firestore, paths.song(organizationId, songId)))
}

/** Aggregate stats for the dashboard and song list header. */
export interface SongStats {
  songs: number
  lines: number
  chords: number
}

export const computeSongStats = (songs: Song[]): SongStats => ({
  songs: songs.length,
  lines: songs.reduce((total, song) => total + countSongLines(song.sections), 0),
  chords: songs.reduce((total, song) => total + countSongChords(song.sections), 0),
})