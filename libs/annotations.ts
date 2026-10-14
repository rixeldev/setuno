import type {
  AnnotationMarker,
  AnnotationMarkerInput,
  SongAnnotation,
  SongSection,
} from "@/interfaces"
import { createId, sectionLabelFor } from "@/libs/songUtils"

/**
 * Pure helpers for per-user song annotations (roadmap #3). They never touch a
 * Firebase SDK, so `tests/unit/annotations.test.ts` can import them directly.
 */

export const ANNOTATION_NOTES_LIMIT = 2000
export const ANNOTATION_MARKERS_LIMIT = 50
export const ANNOTATION_MARKER_TEXT_LIMIT = 500

/** The "no notes yet" state of one song. */
export const EMPTY_ANNOTATION: SongAnnotation = { notes: "", markers: [] }

/** Cuts free-form notes to what the rules accept. */
export const clampAnnotationNotes = (value: string): string => value.slice(0, ANNOTATION_NOTES_LIMIT)

/** Cuts a marker's text to what the rules accept. */
export const clampMarkerText = (value: string): string => value.slice(0, ANNOTATION_MARKER_TEXT_LIMIT)

/** True while another marker can still be added. */
export const canAddMarker = (markers: AnnotationMarker[]): boolean =>
  markers.length < ANNOTATION_MARKERS_LIMIT

export const markerById = (markers: AnnotationMarker[], id: string): AnnotationMarker | null =>
  markers.find((marker) => marker.id === id) ?? null

/**
 * Appends a marker to a copy of the list. Returns the same list when the note
 * is empty or the per-song marker limit is reached.
 */
export const addMarker = (
  markers: AnnotationMarker[],
  input: AnnotationMarkerInput,
): AnnotationMarker[] => {
  const text = clampMarkerText(input.text.trim())
  if (text.length === 0 || input.sectionId.length === 0 || !canAddMarker(markers)) return markers
  return [
    ...markers,
    { id: createId("ann"), sectionId: input.sectionId, lineIndex: input.lineIndex, text },
  ]
}

/** Replaces one marker's text; returns the same list when unknown or empty. */
export const updateMarkerText = (
  markers: AnnotationMarker[],
  id: string,
  text: string,
): AnnotationMarker[] => {
  const next = clampMarkerText(text.trim())
  if (next.length === 0 || !markerById(markers, id)) return markers
  return markers.map((marker) => (marker.id === id ? { ...marker, text: next } : marker))
}

/** Removes one marker; returns the same list when unknown. */
export const removeMarker = (markers: AnnotationMarker[], id: string): AnnotationMarker[] => {
  if (!markerById(markers, id)) return markers
  return markers.filter((marker) => marker.id !== id)
}

/** True when the annotation holds nothing worth rendering. */
export const isEmptyAnnotation = (annotation: SongAnnotation | null | undefined): boolean =>
  !annotation || (annotation.notes.trim().length === 0 && annotation.markers.length === 0)

/**
 * Converts a raw Firestore document into a `SongAnnotation`, dropping marker
 * entries that are malformed (no text or no anchor). Mirrors the whitelisting
 * in `firestore.rules`, whose document-level validation cannot inspect each
 * list entry.
 */
export const annotationFromData = (data: Record<string, unknown>): SongAnnotation => {
  const notes = typeof data.notes === "string" ? clampAnnotationNotes(data.notes) : ""
  const markers: AnnotationMarker[] = []
  if (Array.isArray(data.markers)) {
    for (const raw of data.markers) {
      if (typeof raw !== "object" || raw === null) continue
      const entry = raw as Record<string, unknown>
      const id = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : createId("ann")
      const sectionId = typeof entry.sectionId === "string" ? entry.sectionId : ""
      const lineIndex =
        typeof entry.lineIndex === "number" && Number.isInteger(entry.lineIndex) ? entry.lineIndex : -1
      const text = typeof entry.text === "string" ? clampMarkerText(entry.text) : ""
      if (sectionId.length === 0 || text.trim().length === 0) continue
      markers.push({ id, sectionId, lineIndex, text })
    }
  }
  return { notes, markers, updatedAt: data.updatedAt as SongAnnotation["updatedAt"] }
}

/**
 * Where a marker lands inside a song: `-1` for the section index means the
 * anchored section no longer exists (its chip must not render).
 */
export interface MarkerPlacement {
  marker: AnnotationMarker
  sectionIndex: number
}

/** Resolves markers against a song's sections (ids are display-stable). */
export const markerPlacements = (
  markers: AnnotationMarker[],
  sections: SongSection[],
): MarkerPlacement[] => {
  const indexBySectionId = new Map(sections.map((section, index) => [section.id, index]))
  return markers.map((marker) => ({
    marker,
    sectionIndex: indexBySectionId.get(marker.sectionId) ?? -1,
  }))
}

/** Ordered placements: section order first, then line order inside a section. */
export const sortMarkerPlacements = (placements: MarkerPlacement[]): MarkerPlacement[] => {
  // A marker anchored to a section that no longer exists sorts last.
  const rank = (sectionIndex: number): number =>
    sectionIndex === -1 ? Number.POSITIVE_INFINITY : sectionIndex
  return [...placements].sort(
    (a, b) => rank(a.sectionIndex) - rank(b.sectionIndex) || a.marker.lineIndex - b.marker.lineIndex,
  )
}

/**
 * Anchor label of a marker ("Verse 2 · line 3"), so the editor and the
 * end-of-song block say the same thing about the same note.
 */
export const markerAnchorLabel = (
  marker: AnnotationMarker,
  sections: SongSection[],
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  const sectionIndex = sections.findIndex((section) => section.id === marker.sectionId)
  if (sectionIndex === -1) return t("annotations.removedAnchor")
  const section = sections[sectionIndex]
  const label = sectionLabelFor(sections, sectionIndex, t)
  if (marker.lineIndex === -1) return label
  if (marker.lineIndex < 0 || marker.lineIndex >= section.lines.length) return label
  return t("annotations.lineAnchor", { section: label, line: marker.lineIndex + 1 })
}

/**
 * Sections of a resolved placement, indexed for chip rendering: line-level
 * markers keyed by `sectionId:lineIndex`, and markers that fell back to the
 * whole section (either anchored with `-1` or pointing at a line that no
 * longer exists) keyed by `sectionId`.
 *
 * Only placements whose section exists are included.
 */
export interface MarkerBoards {
  byLine: Map<string, AnnotationMarker[]>
  bySection: Map<string, AnnotationMarker[]>
}

export const markersOfSong = (
  markers: AnnotationMarker[],
  sections: SongSection[],
): MarkerBoards => {
  const byLine = new Map<string, AnnotationMarker[]>()
  const bySection = new Map<string, AnnotationMarker[]>()

  for (const placement of markerPlacements(markers, sections)) {
    if (placement.sectionIndex === -1) continue
    const marker = placement.marker
    const section = sections[placement.sectionIndex]
    if (!section) continue
    if (marker.lineIndex >= 0 && marker.lineIndex < section.lines.length) {
      const key = `${marker.sectionId}:${marker.lineIndex}`
      const current = byLine.get(key) ?? []
      byLine.set(key, [...current, marker])
    } else {
      const current = bySection.get(marker.sectionId) ?? []
      bySection.set(marker.sectionId, [...current, marker])
    }
  }
  return { byLine, bySection }
}