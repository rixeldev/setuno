import type { ChordPosition, LyricLine, SongSection, SongSectionType } from "@/interfaces/song"
import { transposeChord, wordStarts } from "@/libs/chords"

/** Short, collision-resistant id for locally created sections. */
export const createId = (prefix = "id"): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const SECTION_TYPES: { type: SongSectionType; label: string; short: string; i18n: string }[] = [
  { type: "intro", label: "Intro", short: "Intro", i18n: "songs.intro" },
  { type: "verse", label: "Verse", short: "V", i18n: "songs.verse" },
  { type: "pre-chorus", label: "Pre-Chorus", short: "PC", i18n: "songs.preChorus" },
  { type: "chorus", label: "Chorus", short: "Ch", i18n: "songs.chorus" },
  { type: "bridge", label: "Bridge", short: "Br", i18n: "songs.bridge" },
  { type: "outro", label: "Outro", short: "Out", i18n: "songs.outro" },
  { type: "instrumental", label: "Instrumental", short: "Inst", i18n: "songs.instrumental" },
  { type: "custom", label: "Custom", short: "Cus", i18n: "songs.custom" },
]

const SECTION_LABEL_BY_TYPE: Record<SongSectionType, string> = {
  intro: "Intro",
  verse: "Verse",
  "pre-chorus": "Pre-Chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  outro: "Outro",
  instrumental: "Instrumental",
  custom: "Section",
}

/** Default label for a section, numbered per type ("Verse 1", "Chorus 2"). */
export const sectionLabel = (type: SongSectionType, index: number): string => {
  const base = SECTION_LABEL_BY_TYPE[type]
  if (type === "intro" || type === "instrumental" || type === "outro") return base
  return `${base} ${index}`
}

/** Types that are never numbered: "Intro" stays "Intro", not "Intro 2". */
export const isNumberedSection = (type: SongSectionType): boolean =>
  type !== "intro" && type !== "instrumental" && type !== "outro"

/** 1-based position of a section among the ones sharing its type. */
export const sectionOrdinal = (sections: SongSection[], index: number): number => {
  const type = sections[index]?.type
  if (!type) return 1
  let count = 0
  for (let position = 0; position <= index; position += 1) {
    if (sections[position]?.type === type) count += 1
  }
  return count
}

/** i18n key of a section type (custom sections use their own text). */
export const sectionLabelKey = (type: SongSectionType): string =>
  SECTION_TYPES.find((entry) => entry.type === type)?.i18n ?? "songs.custom"

/**
 * Label to render for a section.
 *
 * The stored `label` is only used for **custom** sections: every known type is
 * rendered from its type + ordinal through the translation, so the same song
 * shows "Estrofa 1" for Spanish readers and "Verse 1" for everyone else without
 * touching the stored data.
 */
export const resolveSectionLabel = (
  section: SongSection,
  ordinal: number,
  t: (key: string) => string,
): string => {
  if (section.type === "custom") return section.label.trim() || t("songs.sectionFallback")
  const base = t(sectionLabelKey(section.type))
  return isNumberedSection(section.type) ? `${base} ${ordinal}` : base
}

/** Same as {@link resolveSectionLabel} for a section inside its list. */
export const sectionLabelFor = (
  sections: SongSection[],
  index: number,
  t: (key: string) => string,
): string => {
  const section = sections[index]
  if (!section) return ""
  return resolveSectionLabel(section, sectionOrdinal(sections, index), t)
}

export const emptyLine = (text = ""): LyricLine => ({ text, chords: [] })

export const createSection = (
  type: SongSectionType,
  label: string,
  lines: LyricLine[] = [],
): SongSection => ({ id: createId("sec"), type, label, lines })

export const cloneSections = (sections: SongSection[]): SongSection[] =>
  sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => ({
      text: line.text,
      chords: line.chords.map((chord) => ({ ...chord })),
    })),
  }))

/** Renumbers sections so labels stay sequential after edits. */
export const normalizeSectionLabels = (sections: SongSection[]): SongSection[] => {
  const counters: Partial<Record<SongSectionType, number>> = {}
  return sections.map((section) => {
    if (section.type === "custom" && section.label.trim().length > 0) return section
    const next = (counters[section.type] ?? 0) + 1
    counters[section.type] = next
    return { ...section, label: sectionLabel(section.type, next) }
  })
}

const HEADER_PATTERNS: { type: SongSectionType; pattern: RegExp }[] = [
  { type: "intro", pattern: /^(intro|opening)\b/i },
  { type: "outro", pattern: /^(outro|ending)\b/i },
  { type: "instrumental", pattern: /^(instrumental|instrumental break|interlude|solo|inst)\b/i },
  { type: "pre-chorus", pattern: /^(pre[-\s]?chorus|pre[-\s]? refrain)\b/i },
  { type: "chorus", pattern: /^(chorus|refrain|hook)\b/i },
  { type: "bridge", pattern: /^bridge\b/i },
  { type: "verse", pattern: /^(verse|ver|vs)\b/i },
]

/** Recognises a section header line such as "Chorus", "[Verse 2]" or "BRIDGE:". */
export const detectSectionHeader = (
  rawLine: string,
): { type: SongSectionType; label: string } | null => {
  const cleaned = rawLine
    .trim()
    .replace(/^\[+/, "")
    .replace(/\]+$/, "")
    .replace(/[:\-–—]+$/, "")
    .replace(/\*+/g, "")
    .trim()
  if (cleaned.length === 0 || cleaned.length > 32) return null
  for (const entry of HEADER_PATTERNS) {
    if (entry.pattern.test(cleaned)) {
      const type = entry.type
      return { type, label: cleaned.replace(/\s+/g, " ") }
    }
  }
  return null
}

/**
 * Converts a pasted/plain lyric block into structured sections.
 * Recognised headers (`Chorus`, `[Verse 2]`, `BRIDGE:`...) start a new section;
 * everything else becomes lyric lines.
 */
export const parseLyricBlock = (text: string): SongSection[] => {
  const sections: SongSection[] = []
  let current: SongSection | null = null

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const header = detectSectionHeader(rawLine)
    if (header) {
      current = createSection(header.type, header.label)
      sections.push(current)
      continue
    }
    if (!current) {
      current = createSection("verse", sectionLabel("verse", 1))
      sections.push(current)
    }
    current.lines.push(emptyLine(rawLine))
  }

  // A header that was never followed by a lyric line is dropped: pasting a
  // block with blank lines between sections should not create empty sections.
  return normalizeSectionLabels(
    sections.filter((section) => section.lines.some((line) => line.text.trim().length > 0)),
  )
}

/** Sorts chords by position and removes invalid entries. */
export const normalizeChords = (chords: ChordPosition[], lineLength: number): ChordPosition[] => {
  const seen = new Set<number>()
  return chords
    .filter((chord) => chord.chord.trim().length > 0)
    .map((chord) => ({
      chord: chord.chord.trim(),
      position: Math.max(0, Math.min(Math.round(chord.position), lineLength)),
    }))
    .sort((a, b) => a.position - b.position)
    .filter((chord) => {
      if (seen.has(chord.position)) return false
      seen.add(chord.position)
      return true
    })
}

/**
 * Position limit for the chords of a line.
 *
 * Lines with lyrics clamp every chord to the text length so it stays above a
 * character. Wordless lines (intros, instrumentals, riffs) are a chord
 * progression instead: there is nothing to clamp against, so a new chord can
 * always be appended without typing lyrics first.
 */
export const chordPositionLimit = (text: string): number =>
  text.trim().length > 0 ? text.length : Number.MAX_SAFE_INTEGER

/**
 * The spots a chord can occupy on a line with lyrics: every word start plus the
 * end of the line, so a chord on the last word can still move right.
 */
export const chordAnchors = (text: string): number[] =>
  Array.from(new Set([...wordStarts(text), text.length])).sort((a, b) => a - b)

/**
 * Moves a chord to the previous/next anchor of the line.
 *
 * The chord already sitting on the target **swaps** places instead of being
 * dropped, so moving always works (even between two chords on adjacent words)
 * and never loses data.
 *
 * @returns the same array when the chord cannot move (line boundary).
 */
export const shiftChordToAnchor = (
  chords: ChordPosition[],
  position: number,
  anchors: number[],
  direction: 1 | -1,
  lineLength: number,
): ChordPosition[] => {
  const index = anchors.indexOf(position)
  const target = index === -1 ? undefined : anchors[index + direction]
  if (target === undefined) return chords
  return normalizeChords(
    chords.map((chord) => {
      if (chord.position === position) return { ...chord, position: target }
      if (chord.position === target) return { ...chord, position }
      return chord
    }),
    lineLength,
  )
}

/**
 * Nudges a chord one character left/right, so a chord can sit exactly where the
 * cursor is — even in the middle of a word. Positions already taken by another
 * chord are skipped instead of overwritten.
 *
 * @returns the same array when the chord cannot move (line boundary).
 */
export const shiftChordByCharacter = (
  chords: ChordPosition[],
  position: number,
  direction: 1 | -1,
  lineLength: number,
): ChordPosition[] => {
  const taken = new Set(chords.map((chord) => chord.position))
  let target = position + direction
  while (target >= 0 && target <= lineLength && taken.has(target)) target += direction
  if (target < 0 || target > lineLength) return chords
  return normalizeChords(
    chords.map((chord) => (chord.position === position ? { ...chord, position: target } : chord)),
    lineLength,
  )
}

export interface ChordRowSegment {
  text: string
  /**
   * Set on the chord segments (letter spelling): the reader makes them
   * tappable. Spacing lives in plain segments so the monospace grid is kept.
   */
  chord?: string
}

/**
 * Splits the padded monospace chord row into segments: plain spacing plus one
 * segment per chord. This lets the reader keep the exact character grid while
 * making every chord tappable; `buildChordRow` is simply the joined text.
 */
export const buildChordSegments = (
  chords: (ChordPosition & { label?: string })[],
  text: string,
): ChordRowSegment[] => {
  if (chords.length === 0) return []
  const limit = text.length
  const segments: ChordRowSegment[] = []
  let length = 0

  for (const chord of chords) {
    const label = (chord.label ?? chord.chord).trim()
    const target = Math.max(0, Math.min(Math.round(chord.position), limit))
    // Never place a chord before the end of the previous one.
    const start = Math.max(target, length)
    if (start > length) segments.push({ text: " ".repeat(start - length) })
    segments.push({ text: label, chord: chord.chord.trim() })
    segments.push({ text: " " })
    length = start + label.length + 1
  }

  return segments
}

/**
 * Pads a monospace string so each chord starts exactly `position` characters
 * into the row. Overlapping chords are shifted one column so nothing is drawn
 * on top of anything else.
 *
 * Shared by the reader and the editor preview, and always rendered with the
 * same font size as the lyric line underneath so the columns line up.
 */
export const buildChordRow = (chords: ChordPosition[], text: string): string =>
  buildChordSegments(chords, text)
    .map((segment) => segment.text)
    .join("")

const commonPrefixLength = (a: string, b: string): number => {
  const max = Math.min(a.length, b.length)
  let index = 0
  while (index < max && a[index] === b[index]) index += 1
  return index
}

const commonSuffixLength = (a: string, b: string, prefix: number): number => {
  const max = Math.min(a.length - prefix, b.length - prefix)
  let index = 0
  while (index < max && a[a.length - 1 - index] === b[b.length - 1 - index]) index += 1
  return index
}

/**
 * Keeps every chord glued to the character it sits on while the lyrics change:
 * whatever was typed or deleted before a chord shifts it by the same amount.
 * Chords inside the replaced range collapse to the edit point.
 *
 * Without this, free chord placement would drift as soon as the user types.
 */
export const reanchorChords = (
  chords: ChordPosition[],
  previousText: string,
  nextText: string,
): ChordPosition[] => {
  if (previousText === nextText || chords.length === 0) return chords
  const prefix = commonPrefixLength(previousText, nextText)
  const suffix = commonSuffixLength(previousText, nextText, prefix)
  const removed = previousText.length - prefix - suffix
  const delta = nextText.length - previousText.length

  return chords.map((chord) => {
    // Strict `<`: a chord sitting exactly on the edit point belongs to the text
    // that follows it, so typing there carries the chord along.
    if (chord.position < prefix) return chord
    if (chord.position >= prefix + removed) return { ...chord, position: chord.position + delta }
    return { ...chord, position: prefix }
  })
}

/** Applies a semitone shift to every chord in every section (display only). */
export const transposeSections = (
  sections: SongSection[],
  semitones: number,
): SongSection[] => {
  if (semitones === 0) return sections
  return sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => ({
      text: line.text,
      chords: line.chords.map((chord) => ({
        chord: transposeChord(chord.chord, semitones),
        position: chord.position,
      })),
    })),
  }))
}

export const countSongLines = (sections: SongSection[]): number =>
  sections.reduce((total, section) => total + section.lines.length, 0)

export const countSongChords = (sections: SongSection[]): number =>
  sections.reduce(
    (total, section) =>
      total + section.lines.reduce((lineTotal, line) => lineTotal + line.chords.length, 0),
    0,
  )

export const songLyricsText = (
  sections: SongSection[],
  labelFor?: (section: SongSection, index: number) => string,
): string =>
  sections
    .map((section, index) =>
      [
        `[${labelFor ? labelFor(section, index) : section.label}]`,
        ...section.lines.map((line) => line.text),
      ].join("\n"),
    )
    .join("\n\n")

/** Rough duration estimate (~2.4 words per second) for songs without duration. */
export const estimateDurationSec = (sections: SongSection[]): number => {
  const words = sections.reduce(
    (total, section) =>
      total +
      section.lines.reduce(
        (lineTotal, line) => lineTotal + line.text.split(/\s+/).filter(Boolean).length,
        0,
      ),
    0,
  )
  return Math.max(0, Math.round(words / 2.4))
}

/** Moves a chord to a new position inside its line. */
export const moveChord = (
  chords: ChordPosition[],
  fromPosition: number,
  toPosition: number,
  lineLength: number,
): ChordPosition[] =>
  normalizeChords(
    chords.map((chord) =>
      chord.position === fromPosition
        ? { chord: chord.chord, position: toPosition }
        : { chord: chord.chord, position: chord.position },
    ),
    lineLength,
  )

/** Replaces (or adds/removes) the chord anchored at `position`. */
export const setChordAt = (
  chords: ChordPosition[],
  position: number,
  chord: string,
  lineLength: number,
): ChordPosition[] => {
  const value = chord.trim()
  const others = chords.filter((entry) => entry.position !== position)
  return normalizeChords(value.length > 0 ? [...others, { chord: value, position }] : others, lineLength)
}

/** Appends a blank lyric line after `lineIndex` within a section. */
export const insertLineAfter = (
  lines: LyricLine[],
  lineIndex: number,
): LyricLine[] => {
  const next = [...lines]
  next.splice(lineIndex + 1, 0, emptyLine())
  return next
}