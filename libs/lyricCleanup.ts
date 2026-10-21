import type { ChordPosition } from "@/interfaces/song"
import { serializeChordLine } from "@/libs/chordLine"
import { isRecognizedChord } from "@/libs/chords"
import { readLyricMeta } from "@/libs/lyricMeta"
import { detectSectionHeader } from "@/libs/songUtils"

/**
 * Tidies a messy paste (roadmap #87).
 *
 * The paste importer (#19) already understands the app's own text format. This
 * is the layer before it: it takes what people actually paste — a plain-text
 * chord sheet, a header written between dashes, a line that says the key — and
 * turns it into something the importer can read.
 *
 * Three things happen here, and nothing else:
 *
 * 1. **A chord line is merged into the lyric under it.** A plain-text chord
 *    sheet prints the chords on their own row; the app draws them over the
 *    words they change. The column of the chord is the column of the word.
 * 2. **A header is tidied** — the dashes, the brackets and the repeat marks
 *    around "Chorus" go away, so the importer recognises it.
 * 3. **The lines that are not lyrics are dropped** — the key, the capo, the
 *    tempo, the tuning. The app never sings them.
 *
 * The core is pure and reports what it did, so the editor can show it before
 * anything is committed.
 */

/** What the cleanup did. */
export type CleanupChange = "merged-chords" | "header-tidied" | "dropped-noise"

/** The tidied text and what changed. */
export interface CleanupResult {
  /** The text, in the app's own format. */
  text: string
  /** How many times each thing happened. */
  counts: Partial<Record<CleanupChange, number>>
}

/** Tokens a chord row carries that are not chords. */
const NOISE = new Set(["|", "||", "|||", "|:", ":|", "x", "X", "x2", "-", "—", "."])

/** The headers a sheet may use, in the spelling the app shows. */
const HEADER_WORDS: Record<string, string> = {
  verse: "Verse",
  ver: "Verse",
  vs: "Verse",
  chorus: "Chorus",
  refrain: "Refrain",
  hook: "Hook",
  bridge: "Bridge",
  intro: "Intro",
  opening: "Intro",
  outro: "Outro",
  ending: "Outro",
  interlude: "Interlude",
  solo: "Solo",
  instrumental: "Instrumental",
  inst: "Instrumental",
  "pre-chorus": "Pre-Chorus",
  prechorus: "Pre-Chorus",
  "post-chorus": "Post-Chorus",
  postchorus: "Post-Chorus",
}

/** A chord as it is written, without the punctuation a paste adds. */
const cleanChord = (raw: string): string =>
  raw
    .trim()
    .replace(/[.,;:!?'"()[\]]+$/g, "")
    .trim()

/**
 * The chords of a line and the column each one sits in.
 *
 * `null` when the line is not a chord line — a lyric that happens to contain
 * the word "Am" is still a lyric.
 */
export const chordTokens = (line: string): { chord: string; column: number }[] | null => {
  const tokens: { chord: string; column: number }[] = []
  const pattern = /\S+/g
  let match = pattern.exec(line)
  while (match) {
    const raw = match[0]
    if (!NOISE.has(raw)) {
      const chord = cleanChord(raw)
      if (!isRecognizedChord(chord)) return null
      tokens.push({ chord, column: match.index })
    }
    match = pattern.exec(line)
  }
  return tokens.length > 0 ? tokens : null
}

/** Strips the decoration around a header: dashes, brackets, repeat marks. */
export const tidyHeader = (raw: string): string => {
  let text = raw.trim()
  text = text.replace(/^[\s\-=_*#~—–]+/, "").replace(/[\s\-=_*#~—–]+$/, "")
  text = text.replace(/^\[+/, "").replace(/\]+$/, "")
  text = text.replace(/\(\s*(?:x\s*\d*|\d+\s*x)\s*\)/gi, "")
  text = text.replace(/^\d+\s*[.)]\s*/, "")
  text = text.trim()
  if (text.length === 0) return raw.trim()
  const [first, ...rest] = text.split(/\s+/)
  const known = HEADER_WORDS[first.toLowerCase()]
  return known ? [known, ...rest].join(" ") : text
}

/** A line that is not a lyric at all. */
const isNoise = (line: string): boolean => readLyricMeta(line.trim()) !== null

/** Merges a chord line into the lyric under it, chords over their words. */
const mergeChords = (chordLine: string, lyricLine: string, tokens: { chord: string; column: number }[]): string => {
  const chords: ChordPosition[] = tokens.map((token) => ({
    chord: token.chord,
    // A chord past the end of the lyric sits at its end — the reader draws it
    // as a chord that hangs over the line.
    position: Math.min(token.column, lyricLine.length),
  }))
  return serializeChordLine({ text: lyricLine, chords })
}

/**
 * Tidies a pasted text.
 *
 * The result is the app's own text format, so the paste importer (or the
 * editor) can read it straight away.
 */
export const cleanLyricText = (raw: string): CleanupResult => {
  const counts: Partial<Record<CleanupChange, number>> = {}
  const bump = (kind: CleanupChange): void => {
    counts[kind] = (counts[kind] ?? 0) + 1
  }

  const lines = raw.replace(/\r\n?/g, "\n").split("\n")
  const out: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.replace(/\u00A0/g, " ").replace(/\s+$/, "")
    const trimmed = line.trim()

    if (trimmed.length === 0) {
      out.push("")
      continue
    }

    if (isNoise(trimmed)) {
      bump("dropped-noise")
      continue
    }

    // The header is tidied first: "— Chorus —" is a header once the dashes
    // are gone, and the importer would never see it as one.
    const tidy = tidyHeader(trimmed)
    if (detectSectionHeader(tidy) || detectSectionHeader(trimmed)) {
      if (tidy !== trimmed) bump("header-tidied")
      out.push(tidy)
      continue
    }

    // A chord line with a lyric under it becomes one line: the chords sit
    // over the words they change.
    const tokens = chordTokens(line)
    if (tokens) {
      const next = lines[index + 1]
      const nextLine = next?.replace(/\u00A0/g, " ").replace(/\s+$/, "")
      const nextTrimmed = nextLine?.trim() ?? ""
      const mergeable =
        nextLine !== undefined &&
        nextTrimmed.length > 0 &&
        !isNoise(nextTrimmed) &&
        !detectSectionHeader(tidyHeader(nextTrimmed)) &&
        !chordTokens(nextLine)
      if (mergeable && nextLine !== undefined) {
        out.push(mergeChords(line, nextLine, tokens))
        bump("merged-chords")
        index += 1
        continue
      }
    }

    out.push(line)
  }

  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  return { text, counts }
}
