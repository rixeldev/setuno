import guitarData from "@tombatossals/chords-db/lib/guitar.json"

import { noteName, parseChord, transposeChord } from "@/libs/chords"

/**
 * Chord shape lookups for the reader's “how to play” sheet (docs §11).
 *
 * Guitar voicings come from the open `chords-db` dataset (MIT, bundled and
 * offline, several positions per chord); piano voicings are derived from the
 * chord spelling itself. Everything here is pure so the sheet can render on
 * every platform without extra native modules.
 */

export interface GuitarShape {
  /** Six strings, low E first: -1 muted, 0 open, 1+ relative to `baseFret`. */
  frets: number[]
  /** Finger numbers per string (0 when open/muted). */
  fingers: number[]
  /** Frets held with a barre, relative to `baseFret`. */
  barres: number[]
  /** First fret shown in the diagram. */
  baseFret: number
}

interface GuitarDbEntry {
  suffix: string
  positions: GuitarShape[]
}

const guitarChords = guitarData.chords as unknown as Record<string, GuitarDbEntry[]>

/** The 12 root spellings the dataset is keyed by. */
const DB_ROOT = ["C", "Csharp", "D", "Eb", "E", "F", "Fsharp", "G", "Ab", "A", "Bb", "B"] as const
/** Bass spellings used by the dataset's slash suffixes (both are tried). */
const DB_BASS_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const DB_BASS_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const

/** Suffix spellings bands type that map onto dataset names. */
const ALIASES: Record<string, string> = {
  min: "minor",
  min7: "m7",
  M: "major",
  maj: "major",
  Maj: "major",
  M7: "maj7",
  Ma7: "maj7",
  "Δ7": "maj7",
  sus: "sus4",
  "+": "aug",
  o: "dim",
  "ø": "m7b5",
}

/**
 * Simplest supported suffix for a quality the dataset has no exact entry for,
 * so exotic spellings (C7b13, E6/9…) still get a usable shape.
 */
const FAMILIES: [RegExp, string][] = [
  [/^maj7/, "maj7"],
  [/^maj9/, "maj9"],
  [/^maj11/, "maj11"],
  [/^maj13/, "maj13"],
  [/^maj/, "major"],
  [/^mmaj/, "mmaj7"],
  [/^madd9/, "madd9"],
  [/^m69/, "m69"],
  [/^m6/, "m6"],
  [/^m7b5|^m7\(b5\)|^ø/, "m7b5"],
  [/^m7/, "m7"],
  [/^m9/, "m9"],
  [/^m11/, "m11"],
  [/^m13/, "m13"],
  [/^m/, "minor"],
  [/^dim7|^o7/, "dim7"],
  [/^dim|^o/, "dim"],
  [/^aug7|\+7/, "aug7"],
  [/^aug|\+/, "aug"],
  [/^sus2/, "sus2"],
  [/^7sus4|^7sus/, "7sus4"],
  [/^sus/, "sus4"],
  [/^add9|^add2/, "add9"],
  [/^69/, "69"],
  [/^6/, "6"],
  [/^7/, "7"],
  [/^9/, "9"],
  [/^11/, "11"],
  [/^13/, "13"],
  [/^5/, "5"],
]

const simplifyQuality = (quality: string): string => {
  const mapped = ALIASES[quality] ?? quality
  for (const [pattern, simple] of FAMILIES) {
    if (pattern.test(mapped)) return simple
  }
  return "major"
}

/** Semitone intervals from the root for each simplified quality. */
const CHORD_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  "5": [0, 7],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  aug7: [0, 4, 8, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  "6": [0, 4, 7, 9],
  "69": [0, 4, 7, 9, 14],
  "7": [0, 4, 7, 10],
  "7b5": [0, 4, 6, 10],
  "7b9": [0, 4, 7, 10, 13],
  "7#9": [0, 4, 7, 10, 15],
  "9": [0, 4, 7, 10, 14],
  "9#11": [0, 4, 7, 10, 14, 18],
  "11": [0, 4, 7, 10, 14, 17],
  "13": [0, 4, 7, 10, 14, 21],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  maj11: [0, 4, 7, 11, 14, 17],
  maj13: [0, 4, 7, 11, 14, 21],
  m6: [0, 3, 7, 9],
  m69: [0, 3, 7, 9, 14],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  m13: [0, 3, 7, 10, 14, 21],
  mmaj7: [0, 3, 7, 11],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  alt: [0, 4, 8, 10],
}

/**
 * Guitar voicings for a chord, in the dataset's order (open shapes first).
 * Returns an empty list for anything that is not a chord.
 */
export const findGuitarShapes = (chord: string): GuitarShape[] => {
  const parsed = parseChord(chord)
  if (!parsed.valid || parsed.rootIndex < 0) return []
  const entries = guitarChords[DB_ROOT[parsed.rootIndex]] ?? []
  const mapped = ALIASES[parsed.quality] ?? parsed.quality

  const candidates: string[] = []
  if (parsed.bassIndex !== null && mapped.length > 0) {
    for (const name of new Set([DB_BASS_SHARP[parsed.bassIndex], DB_BASS_FLAT[parsed.bassIndex]])) {
      if (mapped === "minor" || mapped === "m") candidates.push(`m/${name}`)
      else if (mapped === "major") candidates.push(`/${name}`)
    }
  }
  candidates.push(mapped, simplifyQuality(parsed.quality), "major")

  for (const candidate of candidates) {
    if (candidate.length === 0) continue
    const entry = entries.find((item) => item.suffix === candidate)
    if (entry) {
      return entry.positions.map(({ frets, fingers, barres, baseFret }) => ({
        frets,
        fingers,
        barres,
        baseFret,
      }))
    }
  }
  return []
}

export interface PianoChordShape {
  /** Semitone indices (0-11) of the notes, root first. */
  pitchClasses: number[]
  rootIndex: number
  bassIndex: number | null
  /** True when the chord was spelled with flats (guides the note names). */
  usesFlats: boolean
}

/** Piano voicing for a chord, or null for anything that is not a chord. */
export const findPianoChord = (chord: string): PianoChordShape | null => {
  const parsed = parseChord(chord)
  if (!parsed.valid || parsed.rootIndex < 0) return null
  const intervals = CHORD_INTERVALS[simplifyQuality(parsed.quality)] ?? CHORD_INTERVALS.major
  return {
    pitchClasses: intervals.map((semitone) => (parsed.rootIndex + semitone) % 12),
    rootIndex: parsed.rootIndex,
    bassIndex: parsed.bassIndex,
    usesFlats: parsed.usesFlats,
  }
}

/** Note names of a piano voicing (root first), before notation conversion. */
export const pianoNoteNames = (shape: PianoChordShape): string[] =>
  shape.pitchClasses.map((index) => noteName(index, shape.usesFlats))

/**
 * Guitar shape to finger with the current capo: the displayed chord is what
 * the band plays, so the shape sits `capo` semitones below it (the capo raises
 * it back). With no capo the shape is the chord itself.
 */
export const capoShapeChord = (chord: string, capo: number): string =>
  capo > 0 ? transposeChord(chord, -capo) : chord.trim()
