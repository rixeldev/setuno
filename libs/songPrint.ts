import type { LyricLine, Song, SongSection } from "@/interfaces/song"
import { semitonesBetweenKeys } from "@/libs/chords"
import { formatDuration } from "@/libs/format"
import { buildChordRow, estimateDurationSec, sectionLabelFor, transposeSections } from "@/libs/songUtils"

/**
 * Printable sheet for a song or a whole running order (roadmap #20).
 *
 * Pure string building: no React, no `expo-print`, no DOM. `libs/printFile.ts`
 * hands the result to the platform (PDF on native, the browser's print dialog
 * on web), so the whole sheet — including the escaping and the grid — is
 * unit-tested end to end.
 *
 * The chord grid is the same padded character grid the reader draws, so what a
 * member reads on screen is exactly what comes out of the printer.
 */

/** Type scale offered in the print sheet. */
export type PrintScale = "small" | "normal" | "large"

/** Ascending order, as the sheet's chips render them. */
export const PRINT_SCALES: PrintScale[] = ["small", "normal", "large"]

/** Body size in points per scale. */
const SCALE_FONT_PT: Record<PrintScale, number> = { small: 10, normal: 12, large: 15 }

export interface SongPrintOptions {
  /** Print the chord row above each lyric line; `false` prints lyrics only. */
  includeChords: boolean
  scale: PrintScale
  /** Resolves section labels, so the sheet is localized like the app. */
  t: (key: string) => string
}

/** One song of a printed running order. */
export interface SetlistPrintSong {
  song: Song
  /** Key the band plays this song in, taken from the setlist entry. */
  key?: string
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)

/** A line's chords in playing order, without the grid. */
const bareChords = (line: LyricLine): string =>
  [...line.chords]
    .sort((first, second) => first.position - second.position)
    .map((chord) => chord.chord.trim())
    .filter((chord) => chord.length > 0)
    .join("  ")

/**
 * One lyric line as the character grid the reader draws: the chord row padded
 * so every chord sits over the exact character it changes, with the lyrics
 * underneath. A line with no lyrics (intro, riff, instrumental) *is* the
 * progression, and lyrics-only mode drops it the way the reader's pills would
 * have nothing to add.
 */
const printLine = (line: LyricLine, includeChords: boolean): string => {
  const hasLyrics = line.text.trim().length > 0
  if (!hasLyrics) return includeChords ? bareChords(line) : ""
  if (!includeChords) return line.text
  const chordRow = buildChordRow(line.chords, line.text)
  return chordRow.trim().length > 0 ? `${chordRow}\n${line.text}` : line.text
}

interface PrintedSection {
  label: string
  lines: string[]
}

/** Sections rendered to grid text, transposed when this copy is in another key. */
const printSections = (
  sections: SongSection[],
  semitones: number,
  options: SongPrintOptions,
): PrintedSection[] => {
  const transposed = semitones === 0 ? sections : transposeSections(sections, semitones)
  return transposed
    .map((section, index) => ({
      label: sectionLabelFor(transposed, index, options.t),
      lines: section.lines
        .map((line) => printLine(line, options.includeChords))
        .filter((line) => line.trim().length > 0),
    }))
    .filter((section) => section.lines.length > 0)
}

/** Key + capo + tempo + length, the handful of facts a chart needs up top. */
const metaRow = (song: Song, key: string, options: SongPrintOptions): string => {
  const parts: string[] = []
  if (key.trim().length > 0) parts.push(`${options.t("songs.key")}: ${key}`)
  if (song.capo > 0) parts.push(`${options.t("songs.capo")}: ${song.capo}`)
  if (song.bpm !== null) parts.push(`${song.bpm} ${options.t("songs.bpm")}`)
  const duration = song.durationSec ?? estimateDurationSec(song.sections)
  if (duration > 0) parts.push(formatDuration(duration))
  return parts.map((part) => `<span class="meta">${escapeHtml(part)}</span>`).join("")
}

/**
 * Semitones between the song's stored key and the key this copy is printed in.
 * A blank on either side means there is nothing to move by, so the chords are
 * left exactly as written.
 */
const printSemitones = (song: Song, key: string): number => {
  if (song.key.trim().length === 0 || key.trim().length === 0) return 0
  return semitonesBetweenKeys(song.key, key)
}

const songBlock = (
  song: Song,
  key: string,
  options: SongPrintOptions,
  position?: number,
): string => {
  const printedKey = key.trim().length > 0 ? key : song.key
  const sections = printSections(song.sections, printSemitones(song, key), options)
  const sectionsHtml = sections
    .map(
      (section) =>
        `  <section>\n    <h3>${escapeHtml(section.label)}</h3>\n${section.lines
          .map((line) => `    <div class="line">${escapeHtml(line)}</div>`)
          .join("\n")}\n  </section>`,
    )
    .join("\n")

  return `<article class="song">
  ${position === undefined ? "" : `<p class="index">${position}</p>`}<h2>${escapeHtml(song.title)}</h2>${
    song.artist.trim().length > 0 ? `\n  <p class="artist">${escapeHtml(song.artist)}</p>` : ""
  }
  <p class="meta-row">${metaRow(song, printedKey, options)}</p>
${sectionsHtml}
</article>`
}

const documentHtml = (
  title: string,
  body: string,
  scale: PrintScale,
  pageBreakBetween: boolean,
): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 14mm; }
  body {
    margin: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: ${SCALE_FONT_PT[scale]}pt;
    line-height: 1.4;
    color: #111;
  }
  h2 { font-size: 1.35em; margin: 0 0 2pt; }
  h3 {
    font-size: 0.78em;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #666;
    margin: 12pt 0 3pt;
    break-inside: avoid;
  }
  .artist { margin: 0 0 2pt; color: #444; }
  .index { margin: 0 0 2pt; font-weight: 700; color: #666; }
  .meta-row { margin: 0 0 8pt; color: #666; }
  .meta + .meta::before { content: " · "; }
  section { break-inside: avoid; margin-bottom: 6pt; }
  .line {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    white-space: pre-wrap;
  }
  .song + .song { margin-top: 14pt; }${
    pageBreakBetween
      ? '\n  .song { break-before: page; }\n  .song:first-of-type { break-before: auto; }'
      : ""
  }
</style>
</head>
<body>
${body}
</body>
</html>
`

/**
 * One song on its own sheet (roadmap #20).
 *
 * The grid is monospaced through a **system** font stack on purpose: iOS
 * printing renders in a `WKWebView` that cannot load local assets, so a bundled
 * typeface would silently fall back anyway.
 */
export const songPrintHtml = (song: Song, options: SongPrintOptions): string =>
  documentHtml(song.title, songBlock(song, song.key, options), options.scale, false)

/**
 * A whole running order, every song in the key the setlist chose for it (roadmap #20).
 *
 * With chords each song is a chart, so it starts its own page; a lyrics-only
 * list flows continuously, so a short set does not waste a page per song.
 */
export const setlistPrintHtml = (
  title: string,
  songs: SetlistPrintSong[],
  options: SongPrintOptions,
): string => {
  const blocks = songs.map((entry, index) =>
    songBlock(entry.song, entry.key ?? entry.song.key, options, index + 1),
  )
  return documentHtml(title, blocks.join("\n"), options.scale, options.includeChords)
}
