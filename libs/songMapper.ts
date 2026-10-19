import type { LyricLine, SongInput, SongSection } from "@/interfaces"
import { clampSectionBars } from "@/libs/songUtils"
import { normalizeSongStatus } from "@/libs/songStatus"
import { normalizeSongLinks } from "@/libs/songLinks"

/**
 * The editable content of a song as stored (roadmap #26's mapper, moved out of
 * `services/songs.ts` by #38): version documents, the backup parser and every
 * Firestore read normalise through **one** implementation — an invalid stored
 * shape self-heals here instead of three mappers drifting apart. Pure, so the
 * backup parser (`libs/bandBackup.ts`) can import it without dragging Firebase
 * into the bundle.
 */

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
 * Rebuilds a `SongInput` from untrusted JSON. Absence of `status` reads back
 * as active (roadmap #30: no migration), and section/chord shapes self-heal
 * field by field rather than being trusted wholesale.
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
