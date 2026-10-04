import {
  collection,
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
  deleteDoc,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import type {
  SuggestionChange,
  SuggestionInput,
  SuggestionStatus,
  SongSuggestion,
} from "@/interfaces"
import { logActivity } from "@/services/activity"
import { ValidationError } from "@/services/errors"
import { createSong, fetchSong, updateSong } from "@/services/songs"
import { createSection, emptyLine, normalizeSectionLabels, sectionLabel } from "@/libs/songUtils"
import type { SongSection } from "@/interfaces/song"

const mapSuggestion = (data: Record<string, unknown>, id: string): SongSuggestion =>
  ({
    id,
    organizationId: String(data.organizationId ?? ""),
    songId: (data.songId as string | null) ?? null,
    songTitle: String(data.songTitle ?? ""),
    authorId: String(data.authorId ?? ""),
    authorName: String(data.authorName ?? ""),
    type: data.type as SongSuggestion["type"],
    change: (data.change ?? { kind: "other" }) as SuggestionChange,
    summary: String(data.summary ?? ""),
    comment: String(data.comment ?? ""),
    status: (data.status as SuggestionStatus) ?? "pending",
    createdAt: data.createdAt as SongSuggestion["createdAt"],
    reviewedBy: (data.reviewedBy as string | null) ?? null,
    reviewedByName: (data.reviewedByName as string | null) ?? null,
    reviewedAt: (data.reviewedAt as SongSuggestion["reviewedAt"]) ?? null,
    reviewNote: String(data.reviewNote ?? ""),
  }) as SongSuggestion

const describeChange = (change: SuggestionChange): string => {
  switch (change.kind) {
    case "chord_change":
      return change.from.length > 0
        ? `Change chord ${change.from} → ${change.to}`
        : `Add chord ${change.to}`
    case "key_change":
      return `Change key ${change.from} → ${change.to}`
    case "lyrics_change":
      return "Update lyrics"
    case "new_song":
      return `Add new song "${change.title}"`
    default:
      return "General suggestion"
  }
}

export const createSuggestion = async (
  organizationId: string,
  input: SuggestionInput,
  author: { id: string; name: string },
): Promise<string> => {
  const uid = requireUserId()
  if (input.comment.trim().length === 0 && input.summary.trim().length === 0) {
    throw new ValidationError("Describe the change you would like to make.")
  }

  const reference = doc(collection(firestore, paths.suggestions(organizationId)))
  const now = serverTimestamp()
  await setDoc(reference, {
    organizationId,
    songId: input.songId,
    songTitle: input.songTitle,
    authorId: uid,
    authorName: author.name,
    type: input.type,
    change: input.change,
    summary: input.summary.trim() || describeChange(input.change),
    comment: input.comment.trim(),
    status: "pending",
    createdAt: now,
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNote: "",
  })

  void logActivity({
    organizationId,
    type: "suggestion_created",
    message: `${author.name} suggested a change${input.songTitle ? ` to "${input.songTitle}"` : ""}`,
    actorId: uid,
    actorName: author.name,
    targetType: "suggestion",
    targetId: reference.id,
  })

  return reference.id
}

/** Live suggestion feed. `status` filters the list server-side. */
export const subscribeSuggestions = (
  organizationId: string | null,
  status: SuggestionStatus | "all" | undefined,
  onChange: (suggestions: SongSuggestion[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  const base = query(
    collection(firestore, paths.suggestions(organizationId)),
    orderBy("createdAt", "desc"),
    limitTo(200),
  )

  return onSnapshot(
    base,
    (snapshot) => {
      const items = mapDocs(snapshot, mapSuggestion)
      onChange(status && status !== "all" ? items.filter((item) => item.status === status) : items)
    },
    // Keep the last good list on screen and surface a friendly error instead.
    (error) => onError?.(error),
  )
}

export const fetchSuggestions = async (
  organizationId: string,
  status?: SuggestionStatus,
): Promise<SongSuggestion[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, paths.suggestions(organizationId)),
      orderBy("createdAt", "desc"),
      limitTo(200),
    ),
  )
  const items = mapDocs(snapshot, mapSuggestion)
  return status ? items.filter((item) => item.status === status) : items
}

export const fetchSuggestion = async (
  organizationId: string,
  suggestionId: string,
): Promise<SongSuggestion | null> => {
  const snapshot = await getDoc(doc(firestore, paths.suggestion(organizationId, suggestionId)))
  return mapDoc(snapshot, mapSuggestion)
}

export const countPendingSuggestions = async (organizationId: string): Promise<number> => {
  const items = await fetchSuggestions(organizationId, "pending")
  return items.length
}

/** Rejects (or cancels) a suggestion without touching the songbook. */
export const rejectSuggestion = async (
  organizationId: string,
  suggestionId: string,
  reviewer: { id: string; name: string },
  note = "",
): Promise<void> => {
  const uid = requireUserId()
  await updateDoc(doc(firestore, paths.suggestion(organizationId, suggestionId)), {
    status: "rejected",
    reviewedBy: uid,
    reviewedByName: reviewer.name,
    reviewedAt: serverTimestamp(),
    reviewNote: note.trim(),
  })

  void logActivity({
    organizationId,
    type: "suggestion_rejected",
    message: `${reviewer.name} rejected a suggestion`,
    actorId: uid,
    actorName: reviewer.name,
    targetType: "suggestion",
    targetId: suggestionId,
  })
}

const replaceLine = (sections: SongSection[], sectionId: string, lineIndex: number, text: string): SongSection[] =>
  sections.map((section) => {
    if (section.id !== sectionId) return section
    const lines = section.lines.map((line, index) => (index === lineIndex ? { ...line, text } : line))
    return { ...section, lines }
  })

const updateChordAt = (
  sections: SongSection[],
  sectionId: string,
  lineIndex: number,
  position: number,
  chord: string,
): SongSection[] =>
  sections.map((section) => {
    if (section.id !== sectionId) return section
    const lines = section.lines.map((line, index) => {
      if (index !== lineIndex) return line
      const without = line.chords.filter((entry) => entry.position !== position)
      const next = chord.trim().length > 0 ? [...without, { chord: chord.trim(), position }] : without
      return { ...line, chords: next.sort((a, b) => a.position - b.position) }
    })
    return { ...section, lines }
  })

/** Sections created when a "new song" suggestion is accepted. */
const sectionsFromLyrics = (lyrics: string): SongSection[] => {
  const lines = lyrics
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => emptyLine(line.trim()))
  const section = createSection("verse", sectionLabel("verse", 1), lines)
  return normalizeSectionLabels([section])
}

/**
 * Applies a suggestion to the official songbook and marks it accepted.
 * The song update and the suggestion status change are written atomically so
 * the library can never drift from the audit trail.
 */
export const acceptSuggestion = async (
  organizationId: string,
  suggestionId: string,
  reviewer: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const suggestion = await fetchSuggestion(organizationId, suggestionId)
  if (!suggestion) throw new ValidationError("That suggestion no longer exists.")
  if (suggestion.status !== "pending") throw new ValidationError("That suggestion was already reviewed.")

  const change = suggestion.change

  if (change.kind === "new_song" || suggestion.songId === null) {
    if (change.kind !== "new_song") throw new ValidationError("This suggestion has no song to apply.")
    const songId = await createSong(
      organizationId,
      {
        title: change.title,
        artist: change.artist,
        key: change.key,
        originalKey: change.key,
        capo: 0,
        bpm: null,
        durationSec: null,
        genre: "",
        notes: "",
        tags: [],
        sections: sectionsFromLyrics(change.lyrics),
      },
      { id: uid, name: reviewer.name },
    )
    await updateDoc(doc(firestore, paths.suggestion(organizationId, suggestionId)), {
      status: "accepted",
      songId,
      reviewedBy: uid,
      reviewedByName: reviewer.name,
      reviewedAt: serverTimestamp(),
      reviewNote: "",
    })
  } else {
    const song = await fetchSong(organizationId, suggestion.songId)
    if (!song) throw new ValidationError("The song for this suggestion no longer exists.")

    const next = { ...song }
    switch (change.kind) {
      case "chord_change":
        next.sections = updateChordAt(
          song.sections,
          change.sectionId,
          change.lineIndex,
          change.position,
          change.to,
        )
        break
      case "key_change":
        next.key = change.to
        break
      case "lyrics_change":
        next.sections = replaceLine(song.sections, change.sectionId, change.lineIndex, change.to)
        break
      default:
        throw new ValidationError("This suggestion cannot be applied automatically.")
    }

    await updateSong(organizationId, song.id, {
      title: next.title,
      artist: next.artist,
      key: next.key,
      originalKey: next.originalKey,
      capo: next.capo,
      bpm: next.bpm,
      durationSec: next.durationSec,
      genre: next.genre,
      notes: next.notes,
      tags: next.tags,
      sections: next.sections,
    }, reviewer)

    await updateDoc(doc(firestore, paths.suggestion(organizationId, suggestionId)), {
      status: "accepted",
      reviewedBy: uid,
      reviewedByName: reviewer.name,
      reviewedAt: serverTimestamp(),
      reviewNote: "",
    })
  }

  void logActivity({
    organizationId,
    type: "suggestion_accepted",
    message: `${reviewer.name} accepted ${suggestion.authorName}'s suggestion`,
    actorId: uid,
    actorName: reviewer.name,
    targetType: "suggestion",
    targetId: suggestionId,
  })
}

/** Removes a pending suggestion from the feed (author or admin). */
export const deleteSuggestion = async (
  organizationId: string,
  suggestionId: string,
): Promise<void> => {
  await deleteDoc(doc(firestore, paths.suggestion(organizationId, suggestionId)))
}