import type { ChordPosition, LyricLine } from "@/interfaces/song"

/**
 * Inline `[Chord]` handling shared by the ChordPro codec (#18) and the lyric
 * paste importer (#19). Kept in its own module so neither has to import the
 * other (they both depend on `songUtils`, which would create a cycle).
 */

/** Splits an inline `[Chord]` line into plain text plus chord positions. */
export const parseChordLine = (raw: string): LyricLine => {
  const marker = /\[([^\]]*)\]/g
  const chords: ChordPosition[] = []
  let text = ""
  let cursor = 0
  let match = marker.exec(raw)
  while (match) {
    text += raw.slice(cursor, match.index)
    const value = (match[1] ?? "").trim()
    if (value.length > 0) chords.push({ chord: value, position: text.length })
    cursor = match.index + match[0].length
    match = marker.exec(raw)
  }
  text += raw.slice(cursor)
  return { text, chords }
}

/**
 * Rebuilds an inline `[Chord]` line from the app's text + position model.
 *
 * A chord placed past the end of the lyrics (an intro/riff progression, where
 * the app keeps positions beyond an empty line) is padded with spaces so its
 * placement survives the trip — the parsed line is then a chord-only line again.
 */
export const serializeChordLine = (line: LyricLine): string => {
  const chords = [...line.chords]
    .filter((chord) => chord.chord.trim().length > 0)
    .sort((a, b) => a.position - b.position)
  let out = ""
  let textCursor = 0
  for (const chord of chords) {
    const position = Math.max(textCursor, Math.round(chord.position))
    const textEnd = Math.min(position, line.text.length)
    if (textEnd > textCursor) {
      out += line.text.slice(textCursor, textEnd)
      textCursor = textEnd
    }
    if (position > textCursor) {
      out += " ".repeat(position - textCursor)
      textCursor = position
    }
    out += `[${chord.chord.trim()}]`
  }
  out += line.text.slice(textCursor)
  return out
}
