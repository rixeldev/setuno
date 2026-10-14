import type { LyricLine, SongSection, SongSectionType } from "@/interfaces/song"
import { createSection, normalizeSectionLabels, emptyLine } from "@/libs/songUtils"
import { parseChordLine, serializeChordLine } from "@/libs/chordLine"

export { parseChordLine, serializeChordLine } from "@/libs/chordLine"

/**
 * ChordPro import/export (roadmap #18).
 *
 * ChordPro is the lingua franca of atril apps, so round-tripping it lets a song
 * leave and re-enter Setuno without loss of the parts that matter (sections,
 * lyrics and chord positions). Only the widely supported subset is handled:
 * `{title|artist|key|capo|comment}` directives, `{start_of_*}` / `{end_of_*}`
 * sections and inline `[Chord]` markers. Unknown directives are ignored, never
 * treated as lyrics.
 */

export interface ChordProDocument {
  title: string
  artist: string
  key: string
  capo: number
  sections: SongSection[]
}

const DIRECTIVE = /^\{\s*([a-zA-Z0-9_-]+)\s*(?::\s*(.*?))?\s*\}$/

/** Section-start directives (and their short aliases) mapped to a section type. */
const START_DIRECTIVES: Record<string, SongSectionType> = {
  start_of_intro: "intro",
  intro: "intro",
  start_of_verse: "verse",
  verse: "verse",
  sov: "verse",
  start_of_pre_chorus: "pre-chorus",
  start_of_prechorus: "pre-chorus",
  prechorus: "pre-chorus",
  start_of_chorus: "chorus",
  chorus: "chorus",
  soc: "chorus",
  start_of_bridge: "bridge",
  bridge: "bridge",
  sob: "bridge",
  start_of_outro: "outro",
  outro: "outro",
  start_of_instrumental: "instrumental",
  start_of_tab: "instrumental",
  instrumental: "instrumental",
  tab: "instrumental",
  start_of_section: "custom",
  section: "custom",
}

const END_DIRECTIVES = new Set([
  "end_of_intro",
  "end_of_verse",
  "end_of_pre_chorus",
  "end_of_prechorus",
  "end_of_chorus",
  "end_of_bridge",
  "end_of_outro",
  "end_of_instrumental",
  "end_of_tab",
  "end_of_section",
  "eov",
  "eoc",
  "eob",
  "eot",
])

/** Serialization directive per section type. */
const START_BY_TYPE: Record<SongSectionType, string> = {
  intro: "start_of_intro",
  verse: "start_of_verse",
  "pre-chorus": "start_of_pre_chorus",
  chorus: "start_of_chorus",
  bridge: "start_of_bridge",
  outro: "start_of_outro",
  instrumental: "start_of_instrumental",
  custom: "start_of_section",
}

const END_BY_TYPE: Record<SongSectionType, string> = {
  intro: "end_of_intro",
  verse: "end_of_verse",
  "pre-chorus": "end_of_pre_chorus",
  chorus: "end_of_chorus",
  bridge: "end_of_bridge",
  outro: "end_of_outro",
  instrumental: "end_of_instrumental",
  custom: "end_of_section",
}

/** True when a line carries neither lyrics nor chords, so it is just spacing. */
const isBlankLine = (line: LyricLine): boolean =>
  line.text.trim().length === 0 && line.chords.length === 0

/**
 * Parses a ChordPro document into the app's model. Lines outside any section
 * become an implicit verse, and unknown/duplicate directives are ignored.
 */
export const parseChordPro = (source: string): ChordProDocument => {
  const result: ChordProDocument = { title: "", artist: "", key: "", capo: 0, sections: [] }
  const sections: SongSection[] = []
  let current: SongSection | null = null

  const flush = (): void => {
    if (current) {
      // Keep the spacing lines inside a section, but drop a section that ended
      // up with nothing at all.
      if (current.lines.some((line) => !isBlankLine(line))) sections.push(current)
      current = null
    }
  }

  const ensure = (): SongSection => {
    if (!current) current = createSection("verse", "Verse 1", [])
    return current
  }

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "")
    const directive = DIRECTIVE.exec(line.trim())
    if (directive) {
      const name = (directive[1] ?? "").toLowerCase()
      const value = (directive[2] ?? "").trim()
      const startType = START_DIRECTIVES[name]
      if (startType) {
        flush()
        current = createSection(startType, startType === "custom" ? value || "Section" : "", [])
        continue
      }
      if (END_DIRECTIVES.has(name)) {
        flush()
        continue
      }
      switch (name) {
        case "title":
        case "t":
          result.title = value
          break
        case "artist":
        case "subtitle":
        case "st":
          result.artist = value
          break
        case "key":
          result.key = value
          break
        case "capo":
          result.capo = Number.parseInt(value, 10) || 0
          break
        case "comment":
        case "c":
          ensure().lines.push(emptyLine(value))
          break
        default:
          // Unknown directive (define, new_song, chord…): ignore it.
          break
      }
      continue
    }

    if (line.trim().length === 0 && current === null) continue
    ensure().lines.push(parseChordLine(line))
  }
  flush()

  result.sections = normalizeSectionLabels(
    sections.length > 0 ? sections : [createSection("verse", "Verse 1", [emptyLine()])],
  )
  return result
}

/** Serializes the app's song model into a ChordPro document. */
export const serializeChordPro = (document: ChordProDocument): string => {
  const lines: string[] = []
  if (document.title.trim()) lines.push(`{title: ${document.title.trim()}}`)
  if (document.artist.trim()) lines.push(`{artist: ${document.artist.trim()}}`)
  if (document.key.trim()) lines.push(`{key: ${document.key.trim()}}`)
  if (document.capo > 0) lines.push(`{capo: ${document.capo}}`)
  for (const section of document.sections) {
    const label = section.type === "custom" && section.label.trim() ? `: ${section.label.trim()}` : ""
    lines.push(`{${START_BY_TYPE[section.type]}${label}}`)
    for (const line of section.lines) lines.push(serializeChordLine(line))
    lines.push(`{${END_BY_TYPE[section.type]}}`)
    lines.push("")
  }
  return `${lines.join("\n").trimEnd()}\n`
}
