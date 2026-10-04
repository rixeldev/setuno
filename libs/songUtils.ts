import type { ChordPosition, LyricLine, SongSection, SongSectionType } from "@/interfaces/song"
import { transposeChord } from "@/libs/chords"

/** Short, collision-resistant id for locally created sections. */
export const createId = (prefix = "id"): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const SECTION_TYPES: { type: SongSectionType; label: string; short: string }[] = [
  { type: "intro", label: "Intro", short: "Intro" },
  { type: "verse", label: "Verse", short: "V" },
  { type: "pre-chorus", label: "Pre-Chorus", short: "PC" },
  { type: "chorus", label: "Chorus", short: "Ch" },
  { type: "bridge", label: "Bridge", short: "Br" },
  { type: "outro", label: "Outro", short: "Out" },
  { type: "instrumental", label: "Instrumental", short: "Inst" },
  { type: "custom", label: "Custom", short: "Cus" },
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

export const songLyricsText = (sections: SongSection[]): string =>
  sections
    .map((section) =>
      [`[${section.label}]`, ...section.lines.map((line) => line.text)].join("\n"),
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