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
import { ValidationError } from "@/services/errors"
import { countSongChords, countSongLines, normalizeSectionLabels } from "@/libs/songUtils"

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
    return {
      id: typeof section.id === "string" && section.id.length > 0 ? section.id : `sec_${index}`,
      type: (section.type ?? "verse") as SongSection["type"],
      label: typeof section.label === "string" && section.label.length > 0 ? section.label : "Section",
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

const mapSong = (data: Record<string, unknown>, id: string): Song =>
  ({
    id,
    organizationId: String(data.organizationId ?? ""),
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
    input.sections.map((section) => ({
      ...section,
      id: section.id && section.id.length > 0 ? section.id : `sec_${Math.random().toString(36).slice(2, 9)}`,
      label: section.label.trim().length > 0 ? section.label.trim() : "Section",
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
  await updateDoc(doc(firestore, paths.song(organizationId, songId)), {
    ...normalized,
    updatedAt: serverTimestamp(),
  })

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

export const deleteSong = async (
  organizationId: string,
  songId: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const song = await fetchSong(organizationId, songId)
  await deleteDocFor(organizationId, songId)

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