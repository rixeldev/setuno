import type { ChordPosition } from "@/interfaces/song"

/**
 * Splits a lyric line into the visual rows it takes on screen.
 *
 * The reader draws every line as two monospace texts: a chord row and the
 * lyric under it. The platform wraps the lyric at word boundaries, but the
 * chord row is mostly padding, so it wraps wherever it happens to fit — and
 * from that row on, every chord sits over the wrong word (the bug the owner
 * reported while zooming in: a chord that belongs to the end of the phrase
 * jumps to the left of the first row).
 *
 * So the wrap is computed here instead. The line is cut into rows of at most
 * `charsPerRow` characters, cut at word boundaries, and a chord that would not
 * fit in its row moves the cut earlier — the chord always stays over its word.
 * Every row is then drawn as its own chord row plus its own lyric row, so the
 * two can never drift apart.
 *
 * The maths is pure: the caller measures how many characters fit (the mono
 * face is bundled, so its advance is known) and hands the number over.
 */

/** A chord of a row, with the spelling it is drawn with. */
export interface LyricRowChord {
  /** The chord as it is stored — the tap opens its shapes. */
  chord: string
  /** The chord as it is spelled on screen. */
  label: string
  /** The offset of the chord inside the row. */
  offset: number
}

/** One visual row of a lyric line. */
export interface LyricRow {
  /** The lyric text of the row. */
  text: string
  /** Where the row starts in the line. */
  start: number
  /** The chords drawn over this row. */
  chords: LyricRowChord[]
}

/** A chord with the spelling it is drawn with. */
export type RowChord = ChordPosition & { label?: string }

/**
 * The advance of the bundled mono face, as a fraction of the font size.
 *
 * JetBrains Mono is 600 units wide on a 1000-unit em, so every glyph — a
 * space, a letter, a non-breaking space — takes the same 0.6 em. The number
 * is only the starting point: the reader measures the face at run time and
 * uses the measurement when it has one.
 */
export const MONO_ADVANCE_RATIO = 0.6

/**
 * How many characters of the mono face fit in a width.
 *
 * A character that would end exactly on the edge is left out: the platform
 * rounds the advance, and a row one character too long wraps on its own and
 * loses its chords.
 */
export const charactersPerRow = (widthPx: number, advancePx: number): number => {
  if (widthPx <= 0 || advancePx <= 0) return 0
  return Math.max(0, Math.floor((widthPx - 1) / advancePx))
}

/** The advance of one character at a given size. */
export const monoAdvance = (fontSize: number, ratio: number = MONO_ADVANCE_RATIO): number =>
  fontSize * (ratio > 0 ? ratio : MONO_ADVANCE_RATIO)

/** The words of a line, with the spans they occupy. */
const wordSpans = (text: string): { start: number; end: number }[] => {
  const spans: { start: number; end: number }[] = []
  const pattern = /\S+/g
  let match = pattern.exec(text)
  while (match) {
    spans.push({ start: match.index, end: match.index + match[0].length })
    match = pattern.exec(text)
  }
  return spans
}

const labelOf = (chord: RowChord): string => chord.label ?? chord.chord

/**
 * Every chord that would be drawn over the span `[start, end]`, with the
 * offset it takes inside it. A chord past the end of the span is not in it.
 */
const chordsIn = (
  chords: readonly RowChord[],
  start: number,
  end: number,
): { chord: string; label: string; offset: number }[] =>
  chords
    .filter((chord) => chord.position >= start && chord.position <= end)
    .map((chord) => ({ chord: chord.chord, label: labelOf(chord), offset: chord.position - start }))

/** True when every chord of the span still fits in the row. */
const chordsFit = (
  chords: readonly RowChord[],
  start: number,
  end: number,
  charsPerRow: number,
): boolean =>
  chordsIn(chords, start, end).every((chord) => chord.offset + chord.label.length <= charsPerRow)

/**
 * Cuts a line into its visual rows.
 *
 * `charsPerRow` is how many monospace characters fit on a row; `0` (or less)
 * means "unknown" and the line is returned as a single row, exactly as it was
 * drawn before the reader learned to measure.
 */
export const splitLyricRows = (
  text: string,
  chords: readonly RowChord[],
  charsPerRow: number,
): LyricRow[] => {
  const sorted = [...chords]
    .filter((chord) => chord.chord.trim().length > 0)
    .sort((a, b) => a.position - b.position)
  const spans = wordSpans(text)

  if (charsPerRow <= 0 || spans.length === 0) {
    return [
      {
        text,
        start: 0,
        chords: sorted.map((chord) => ({
          chord: chord.chord,
          label: labelOf(chord),
          offset: chord.position,
        })),
      },
    ]
  }

  const rows: LyricRow[] = []
  let rowStart = spans[0].start
  let rowEnd = rowStart

  for (const word of spans) {
    const fits =
      word.end - rowStart <= charsPerRow && chordsFit(sorted, rowStart, word.end, charsPerRow)
    if (!fits && word.start > rowStart) {
      // The word (or the chord over it) does not fit: the row ends before it.
      rows.push({ text: text.slice(rowStart, rowEnd), start: rowStart, chords: chordsIn(sorted, rowStart, rowEnd) })
      rowStart = word.start
      rowEnd = word.end
      continue
    }
    rowEnd = word.end
  }
  rows.push({ text: text.slice(rowStart, rowEnd), start: rowStart, chords: chordsIn(sorted, rowStart, rowEnd) })

  // A chord that fell in the gap between two rows (it sits on the spaces
  // between the words) belongs to the row it follows, never to nobody.
  const assigned = new Set(rows.flatMap((row) => row.chords.map((chord) => chord.offset + row.start)))
  for (const chord of sorted) {
    if (assigned.has(chord.position)) continue
    const row = [...rows].reverse().find((candidate) => candidate.start <= chord.position)
    if (!row) continue
    row.chords.push({ chord: chord.chord, label: labelOf(chord), offset: chord.position - row.start })
  }

  return rows
}
