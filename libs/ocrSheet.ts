import type { ChordPosition, LyricLine } from "@/interfaces/song"
import type { OcrResult, OcrWord } from "@/interfaces/ocr"
import { serializeChordLine } from "@/libs/chordLine"
import { isRecognizedChord } from "@/libs/chords"
import { readLyricMeta, type LyricMeta } from "@/libs/lyricMeta"
import { detectSectionHeader } from "@/libs/songUtils"

/**
 * Turns a recognized sheet into a **proposal** (roadmap #84).
 *
 * The pure core of the photo/PDF importer: it reads the rows the recognizer
 * found, works out which ones are chords, which ones are lyrics and which ones
 * are a section header, and puts the chords back where they belong — over the
 * word they change.
 *
 * Nothing here is saved: the proposal is always reviewed in the editor first,
 * because a recognition is never certain. The warnings are the honest part of
 * the feature (`OcrWarning`).
 */

/** What the member should look at before saving the proposal. */
export type OcrWarning = "no-chords" | "unsure" | "too-short" | "no-lyrics"

/** The song the sheet proposes. */
export interface OcrProposal {
  /** The title the sheet seems to carry (it may be a lyric line — the member fixes it). */
  title: string
  /** The key the sheet declares, if any. */
  key: string | null
  /** The capo the sheet declares, if any. */
  capo: number | null
  /** The tempo the sheet declares, if any. */
  bpm: number | null
  /** The lyrics, with the chords inline as `[C]` markers (the app's own text format). */
  text: string
  /** How much of the sheet was understood, from 0 to 1. */
  confidence: number
  /** The things worth a second look. */
  warnings: OcrWarning[]
}

/** What a row of the sheet turned out to be. */
type RowKind = "chords" | "header" | "meta" | "lyrics"

/** One row of the sheet, with what it turned out to be. */
interface Row {
  text: string
  words: OcrWord[]
  kind: RowKind
  /** Where the row starts, vertically. */
  top: number
  height: number
  page: number
  /** The recognizer's own confidence (0..1), when the platform gives one. */
  confidence: number | null
}

/** Tokens a chord row carries that are not chords (bar lines, repeat marks). */
const NOISE = new Set(["|", "||", "|||", "|:", ":|", "|:|", "x", "X", "x2", "-", "—", "•", "."])

/** A chord as it is written on the sheet, without the punctuation OCR adds. */
const cleanChord = (raw: string): string =>
  raw
    .trim()
    .replace(/[.,;:!?'"()[\]]+$/g, "")
    .trim()

/** The metadata a row carries, if it is a metadata row at all. */
type RowMeta = LyricMeta

/** Reads the metadata of a row, or `null` when the row is not metadata. */
const readMeta = (text: string): RowMeta | null => readLyricMeta(text)

/** True when every meaningful word of the row is a chord. */
const isChordRow = (words: OcrWord[]): boolean => {
  let chords = 0
  for (const word of words) {
    const raw = word.text.trim()
    if (raw.length === 0 || NOISE.has(raw)) continue
    if (!isRecognizedChord(cleanChord(raw))) return false
    chords += 1
  }
  return chords > 0
}

/** Builds the rows of the sheet, page by page, in reading order. */
const buildRows = (result: OcrResult): Row[] => {
  const rows: Row[] = []
  result.pages.forEach((page, pageIndex) => {
    for (const line of page.lines) {
      const text = line.text.replace(/\s+/g, " ").trim()
      if (text.length === 0) continue
      const words = line.words.filter((word) => word.text.trim().length > 0)
      const kind: RowKind = detectSectionHeader(text)
        ? "header"
        : readMeta(text)
          ? "meta"
          : isChordRow(words)
            ? "chords"
            : "lyrics"
      rows.push({
        text,
        words,
        kind,
        top: line.box.y,
        height: Math.max(line.box.height, 1),
        page: pageIndex,
        confidence:
          typeof line.confidence === "number" && Number.isFinite(line.confidence)
            ? Math.max(0, Math.min(1, line.confidence))
            : null,
      })
    }
  })
  return rows
}

/** The average width of a character, estimated from the words of the row. */
const charWidth = (words: OcrWord[]): number => {
  let width = 0
  let length = 0
  for (const word of words) {
    width += word.box.width
    length += word.text.trim().length
  }
  if (length === 0) return 1
  return Math.max(width / length, 0.5)
}

/** The offsets of the words inside the text the row spells out. */
const wordOffsets = (words: OcrWord[]): number[] => {
  const offsets: number[] = []
  let cursor = 0
  for (const word of words) {
    offsets.push(cursor)
    cursor += word.text.trim().length + 1
  }
  return offsets
}

/**
 * Puts every chord of a chord row over the word it changes.
 *
 * The chord is printed right above the syllable it belongs to, so its left
 * edge points at the word underneath. When the two do not line up (a tilted
 * photo, a bad crop), the nearest word wins — an approximate chord is still
 * far better than a lost one.
 */
const alignChords = (chordRow: Row, lyricRow: Row): ChordPosition[] => {
  const words = lyricRow.words
  if (words.length === 0) return []
  const offsets = wordOffsets(words)
  const chords: ChordPosition[] = []
  for (const word of chordRow.words) {
    const raw = word.text.trim()
    if (raw.length === 0 || NOISE.has(raw)) continue
    const chord = cleanChord(raw)
    if (chord.length === 0) continue
    const left = word.box.x
    let index = words.findIndex((w) => left >= w.box.x && left <= w.box.x + w.box.width)
    if (index < 0) {
      let best = 0
      let distance = Number.POSITIVE_INFINITY
      words.forEach((w, i) => {
        const delta = Math.abs(w.box.x - left)
        if (delta < distance) {
          distance = delta
          best = i
        }
      })
      index = best
    }
    chords.push({ chord, position: offsets[index] ?? 0 })
  }
  return chords
}

/** A chord row with nothing under it: an intro progression, on its own line. */
const orphanChords = (chordRow: Row): ChordPosition[] => {
  const width = charWidth(chordRow.words)
  const chords: ChordPosition[] = []
  for (const word of chordRow.words) {
    const raw = word.text.trim()
    if (raw.length === 0 || NOISE.has(raw)) continue
    const chord = cleanChord(raw)
    if (chord.length === 0) continue
    const offset = Math.max(0, Math.round((word.box.x - chordRow.words[0]!.box.x) / width))
    chords.push({ chord, position: offset })
  }
  return chords
}

/** The text of a row, rebuilt from its words so the chord offsets fit. */
const rowText = (row: Row): string =>
  row.words.length > 0 ? row.words.map((word) => word.text.trim()).join(" ") : row.text

/** The median height of the rows — the usual size of a line of the sheet. */
const medianHeight = (rows: Row[]): number => {
  if (rows.length === 0) return 1
  const heights = rows.map((row) => row.height).sort((a, b) => a - b)
  return heights[Math.floor(heights.length / 2)] ?? 1
}

/**
 * Reads a recognized sheet and proposes a song.
 *
 * The proposal is never saved as it is: the member reviews it in the editor.
 */
export const proposeSongFromOcr = (result: OcrResult): OcrProposal => {
  const rows = buildRows(result)

  let key: string | null = null
  let capo: number | null = null
  let bpm: number | null = null
  for (const row of rows) {
    if (row.kind !== "meta") continue
    const meta = readMeta(row.text)
    if (!meta) continue
    key = key ?? meta.key
    capo = capo ?? meta.capo
    bpm = bpm ?? meta.bpm
  }

  // The title is the first line of the sheet, and only when it is clearly
  // printed bigger than the rest — a sheet without a title must not lose its
  // first lyric line to a guess.
  const lineHeight = medianHeight(rows)
  const firstContent = rows.find((row) => row.kind !== "meta" && row.kind !== "chords") ?? null
  const titleRow = firstContent && firstContent.height >= lineHeight * 1.25 ? firstContent : null
  const title = titleRow?.text ?? ""

  const chordsByRow = new Map<Row, ChordPosition[]>()
  const orphanRows = new Set<Row>()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    if (row.kind !== "chords") continue
    const next = rows[index + 1]
    if (next && next.kind === "lyrics" && next.page === row.page) {
      chordsByRow.set(next, alignChords(row, next))
    } else {
      orphanRows.add(row)
    }
  }

  const lines: string[] = []
  let lyricLines = 0
  let chordCount = 0
  let previousBottom: number | null = null
  let previousPage = -1

  for (const row of rows) {
    if (row.kind === "meta") continue
    if (row === titleRow) {
      previousBottom = row.top + row.height
      previousPage = row.page
      continue
    }
    if (row.kind === "header") {
      lines.push(row.text)
      previousBottom = row.top + row.height
      previousPage = row.page
      continue
    }
    if (row.kind === "chords") {
      if (!orphanRows.has(row)) continue
      const chords = orphanChords(row)
      chordCount += chords.length
      const line: LyricLine = { text: "", chords }
      lines.push(serializeChordLine(line))
      previousBottom = row.top + row.height
      previousPage = row.page
      continue
    }

    // A lyric row. A gap bigger than the usual line height is a stanza break.
    if (
      previousBottom !== null &&
      previousPage === row.page &&
      row.top - previousBottom > lineHeight * 1.4 &&
      lines.length > 0 &&
      lines[lines.length - 1]!.trim().length > 0
    ) {
      lines.push("")
    }

    const chords = chordsByRow.get(row) ?? []
    chordCount += chords.length
    const line: LyricLine = { text: rowText(row), chords }
    const serialized = serializeChordLine(line)
    if (line.text.trim().length > 0) lyricLines += 1
    lines.push(serialized)
    previousBottom = row.top + row.height
    previousPage = row.page
  }

  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()

  // How much of the sheet was understood: the recognizer's own confidence
  // when the platform gives one, and how many chord tokens really were chords.
  const confidences = rows.map((row) => row.confidence).filter((value): value is number => value !== null)
  const ocrConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null
  const chordTokens = rows
    .filter((row) => row.kind === "chords")
    .flatMap((row) => row.words)
    .filter((word) => word.text.trim().length > 0 && !NOISE.has(word.text.trim()))
  const recognizedChords = chordTokens.filter((word) => isRecognizedChord(cleanChord(word.text))).length
  const chordQuality = chordTokens.length > 0 ? recognizedChords / chordTokens.length : null
  const confidence = Math.max(
    0,
    Math.min(
      1,
      Math.round(
        (ocrConfidence === null
          ? (chordQuality ?? 0.5)
          : ocrConfidence * 0.6 + (chordQuality ?? 1) * 0.4) * 100,
      ) / 100,
    ),
  )

  const warnings: OcrWarning[] = []
  if (lyricLines === 0) warnings.push("no-lyrics")
  if (chordCount === 0) warnings.push("no-chords")
  if (lyricLines > 0 && lyricLines < 3) warnings.push("too-short")
  if (confidence < 0.6) warnings.push("unsure")

  return { title, key, capo, bpm, text, confidence, warnings }
}
