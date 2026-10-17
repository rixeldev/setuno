/**
 * View layer of a share (roadmap #56): turns the payload the `createShare`
 * callable sanitized into the app's own rendering types. Pure and unit-tested
 * (no React Native), because a public screen renders whatever this returns.
 *
 * The payload's `section.type` is deliberately a free string — the callable
 * must not mirror the app's `SongSectionType` union or every new section type
 * would need two places kept in step. This module is the single validation
 * point: known types ride through `SECTION_TYPES` (the same list the editor
 * offers), anything else degrades to `custom` and keeps its stored label, so a
 * future type never breaks an old link or renders blank.
 */
import { SECTION_TYPES, clampSectionBars } from "@/libs/songUtils"
import type { SongSection } from "@/interfaces"
import type {
  SharedSection,
  SharedSetlistEntry,
  SharedSetlistPayload,
} from "@/functions/src/shares"

const KNOWN_SECTION_TYPES: ReadonlySet<string> = new Set(
  SECTION_TYPES.map((entry) => entry.type),
)

/** Payload sections → the shape `SongContent` renders. Never mutates input. */
export const sharedSections = (sections: readonly SharedSection[]): SongSection[] =>
  sections.map((section, index) => {
    const type = KNOWN_SECTION_TYPES.has(section.type)
      ? (section.type as SongSection["type"])
      : "custom"
    const bars =
      typeof section.bars === "number" && section.bars > 0 ? clampSectionBars(section.bars) : 0
    return {
      id: section.id.length > 0 ? section.id : `sec_${index}`,
      type,
      label: section.label.length > 0 ? section.label : "Section",
      ...(bars > 0 ? { bars } : {}),
      lines: section.lines.map((line) => ({
        text: line.text,
        chords: line.chords.map((chord) => ({ chord: chord.chord, position: chord.position })),
      })),
    }
  })

/** One rendered line of a shared setlist: a divider header or a numbered song. */
export type SharedSetlistRow =
  | { kind: "divider"; name: string }
  | { kind: "song"; entry: SharedSetlistEntry; index: number }

/**
 * Interleave a payload's dividers with its entries, same contract as the real
 * running order (#43 `libs/setlistBlocks.ts#listRows`): a divider lands after
 * the song it anchors to, `afterSongId: null` opens the list, and one whose
 * song is missing renders after the last song instead of disappearing.
 * Numbers count songs only.
 */
export const sharedSetlistRows = (payload: SharedSetlistPayload): SharedSetlistRow[] => {
  const pending = new Map<string | null, string[]>()
  for (const divider of payload.dividers) {
    const anchor = divider.afterSongId
    const queue = pending.get(anchor)
    if (queue) queue.push(divider.name)
    else pending.set(anchor, [divider.name])
  }

  const rows: SharedSetlistRow[] = []
  for (const name of pending.get(null) ?? []) rows.push({ kind: "divider", name })
  pending.delete(null)

  payload.entries.forEach((entry, index) => {
    rows.push({ kind: "song", entry, index: index + 1 })
    for (const name of pending.get(entry.songId) ?? []) rows.push({ kind: "divider", name })
    pending.delete(entry.songId)
  })

  // Anchored to a song that left the list: still shown, after the last song.
  for (const names of pending.values()) {
    for (const name of names) rows.push({ kind: "divider", name })
  }
  return rows
}
