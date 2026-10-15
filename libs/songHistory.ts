import type { LyricLine, Song, SongInput, SongSection } from "@/interfaces"
import type { MaybeTimestamp } from "@/interfaces/timestamp"
import { toMillis } from "@/interfaces/timestamp"
import { diffWords, type DiffSegment } from "@/libs/songDiff"

/**
 * Version history of a song (roadmap #26), kept pure like the diff engine it
 * reuses (`libs/songDiff.ts`): nothing here touches React or Firestore, so
 * the whole comparison and the pruning maths unit-test without a device.
 *
 * The comparison is **aligned by the sections' stable ids**, not by
 * position: an edit inside a section marks its lines, an inserted or deleted
 * section shows up whole, and moving a section pairs it instead of reporting
 * a delete plus an add. Removed sections are placed right before the
 * surviving section that followed them, so the diff reads in the older
 * song's order.
 */

/** How many versions a song keeps; the oldest beyond it are pruned. */
export const SONG_VERSION_CAP = 20

/**
 * The content of a version: every editable field of the song and nothing
 * else — restoring writes exactly this back, so identity (`id`,
 * `organizationId`) and audit fields (`createdBy`, timestamps) stay out.
 */
export const songVersionData = (song: Song): SongInput => ({
  title: song.title,
  artist: song.artist,
  key: song.key,
  originalKey: song.originalKey,
  capo: song.capo,
  bpm: song.bpm,
  durationSec: song.durationSec,
  genre: song.genre,
  notes: song.notes,
  tags: song.tags,
  sections: song.sections,
  links: song.links,
})

interface VersionStamp {
  id: string
  savedAt: MaybeTimestamp | string
}

const versionTime = (version: VersionStamp): number => toMillis(version.savedAt) ?? 0

/**
 * Newest first, breaking exact-time ties by id so the list, the pruned set
 * and every caller agree on one order even when two saves land in the same
 * millisecond.
 */
export const compareVersionsDesc = (a: VersionStamp, b: VersionStamp): number => {
  const left = versionTime(a)
  const right = versionTime(b)
  if (left !== right) return right - left
  if (a.id === b.id) return 0
  return a.id > b.id ? -1 : 1
}

/** A copy of the list in the order the history shows it (newest first). */
export const sortVersionsDesc = <T extends VersionStamp>(versions: T[]): T[] =>
  [...versions].sort(compareVersionsDesc)

/** Ids of the versions past the cap — the oldest — in prune order. */
export const versionsToPrune = <T extends VersionStamp>(
  versions: T[],
  cap: number = SONG_VERSION_CAP,
): string[] => sortVersionsDesc(versions).slice(cap).map((version) => version.id)

/** The metadata fields the diff compares (content lives in the sections). */
export type VersionDiffFieldKey =
  | "title"
  | "artist"
  | "key"
  | "capo"
  | "bpm"
  | "genre"
  | "notes"
  | "tags"

export interface VersionDiffField {
  field: VersionDiffFieldKey
  segments: DiffSegment[]
}

export type VersionLineKind = "same" | "changed" | "added" | "removed"

export interface VersionDiffLine {
  kind: VersionLineKind
  /** Word-level diff of the lyric text (kept runs included, for context). */
  lyrics: DiffSegment[]
  /** Diff of the chord progression (names in order); null while it matches. */
  chords: DiffSegment[] | null
}

export interface VersionDiffSection {
  kind: "changed" | "added" | "removed"
  /** The two sides of the pair; one is null when it exists on one side only. */
  before: SongSection | null
  after: SongSection | null
  lines: VersionDiffLine[]
}

export interface VersionDiff {
  /** Metadata fields that differ, in a stable order. */
  fields: VersionDiffField[]
  /** Sections that differ (whole when added/removed), in reading order. */
  sections: VersionDiffSection[]
  changed: boolean
}

const DIFF_FIELDS: VersionDiffFieldKey[] = [
  "title",
  "artist",
  "key",
  "capo",
  "bpm",
  "genre",
  "notes",
  "tags",
]

const fieldText = (data: SongInput, field: VersionDiffFieldKey): string => {
  switch (field) {
    case "title":
      return data.title
    case "artist":
      return data.artist
    case "key":
      return data.key
    case "capo":
      return String(data.capo)
    case "bpm":
      return data.bpm == null ? "" : String(data.bpm)
    case "genre":
      return data.genre
    case "notes":
      return data.notes
    case "tags":
      return data.tags.join(", ")
  }
}

/** A line's progression as the diff compares it: its chords, in order. */
const chordTokens = (line: LyricLine): string =>
  line.chords.map((chord) => chord.chord).join(" ")

const changedLine = (before: LyricLine, after: LyricLine): VersionDiffLine => {
  const oldChords = chordTokens(before)
  const newChords = chordTokens(after)
  const chords = oldChords === newChords ? null : diffWords(oldChords, newChords)
  return {
    kind: before.text === after.text && chords === null ? "same" : "changed",
    lyrics: diffWords(before.text, after.text),
    chords,
  }
}

const addedLine = (line: LyricLine): VersionDiffLine => {
  const tokens = chordTokens(line)
  return {
    kind: "added",
    lyrics: diffWords("", line.text),
    chords: tokens.length > 0 ? diffWords("", tokens) : null,
  }
}

const removedLine = (line: LyricLine): VersionDiffLine => {
  const tokens = chordTokens(line)
  return {
    kind: "removed",
    lyrics: diffWords(line.text, ""),
    chords: tokens.length > 0 ? diffWords(tokens, "") : null,
  }
}

/** Line-by-line within one paired section; the extra tail lines come whole. */
const compareLines = (before: SongSection, after: SongSection): VersionDiffLine[] => {
  const count = Math.max(before.lines.length, after.lines.length)
  const lines: VersionDiffLine[] = []
  for (let index = 0; index < count; index += 1) {
    const old = before.lines[index]
    const next = after.lines[index]
    if (old && next) lines.push(changedLine(old, next))
    else if (next) lines.push(addedLine(next))
    else if (old) lines.push(removedLine(old))
  }
  return lines
}

const compareSection = (
  before: SongSection,
  after: SongSection,
): VersionDiffSection | null => {
  const lines = compareLines(before, after)
  const headerMatches =
    before.type === after.type &&
    before.label === after.label &&
    (before.bars ?? 0) === (after.bars ?? 0)
  if (headerMatches && lines.every((line) => line.kind === "same")) return null
  return { kind: "changed", before, after, lines }
}

const wholeSection = (
  section: SongSection,
  kind: "added" | "removed",
): VersionDiffSection => ({
  kind,
  before: kind === "removed" ? section : null,
  after: kind === "added" ? section : null,
  lines: section.lines.map((line) => (kind === "added" ? addedLine(line) : removedLine(line))),
})

/**
 * What changed between two states of a song. Sections pair by id, metadata
 * compares field by field, and `changed` is false only when the two states
 * are indistinguishable — the renderer then says so instead of drawing an
 * empty diff.
 */
export const versionDiff = (before: SongInput, after: SongInput): VersionDiff => {
  const fields: VersionDiffField[] = []
  for (const field of DIFF_FIELDS) {
    const from = fieldText(before, field)
    const to = fieldText(after, field)
    if (from !== to) fields.push({ field, segments: diffWords(from, to) })
  }

  const afterIds = new Set(after.sections.map((section) => section.id))
  // Where each removed section goes: right before the next surviving
  // section, or at the end when nothing after it survives.
  const anchorOf = (section: SongSection): string | null => {
    const index = before.sections.indexOf(section)
    for (let next = index + 1; next < before.sections.length; next += 1) {
      const candidate = before.sections[next]
      if (afterIds.has(candidate.id)) return candidate.id
    }
    return null
  }
  const removedByAnchor = new Map<string | null, SongSection[]>()
  for (const section of before.sections) {
    if (afterIds.has(section.id)) continue
    const key = anchorOf(section)
    const bucket = removedByAnchor.get(key)
    if (bucket) bucket.push(section)
    else removedByAnchor.set(key, [section])
  }

  const sections: VersionDiffSection[] = []
  const emitRemoved = (anchor: string | null): void => {
    for (const section of removedByAnchor.get(anchor) ?? []) {
      sections.push(wholeSection(section, "removed"))
    }
  }
  for (const section of after.sections) {
    emitRemoved(section.id)
    const previous = before.sections.find((candidate) => candidate.id === section.id)
    if (previous) {
      const entry = compareSection(previous, section)
      if (entry) sections.push(entry)
    } else {
      sections.push(wholeSection(section, "added"))
    }
  }
  emitRemoved(null)

  return { fields, sections, changed: fields.length > 0 || sections.length > 0 }
}
