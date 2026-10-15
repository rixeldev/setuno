import guitarData from "@tombatossals/chords-db/lib/guitar.json"
import ukuleleData from "@tombatossals/chords-db/lib/ukulele.json"

import { noteName, parseChord, transposeChord } from "@/libs/chords"
import type { ChordInstrument } from "@/interfaces/user"

/**
 * Chord shape lookups for the reader's “how to play” sheet (docs §11).
 *
 * Fretted voicings — guitar and ukulele — come from the open `chords-db`
 * dataset (MIT, bundled and offline, several positions per chord) through the
 * same lookup, since both ship the same JSON shape. Bass has no entry in that
 * dataset, so its positions are derived from the chord spelling; piano is
 * derived the same way. Everything here is pure so the sheet can render on
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
const ukuleleChords = ukuleleData.chords as unknown as Record<string, GuitarDbEntry[]>

/** Fretted instruments backed by the bundled dataset (roadmap #24). */
export type FrettedInstrument = "guitar" | "ukulele"

/**
 * Both instruments ship in `@tombatossals/chords-db` with the same JSON shape
 * — one entry per root, several positions each — so they share one lookup.
 */
const FRETTED_DATA: Record<FrettedInstrument, Record<string, GuitarDbEntry[]>> = {
  guitar: guitarChords,
  ukulele: ukuleleChords,
}

/** Narrowing guard for the dataset-backed instruments. */
export const isFrettedInstrument = (value: ChordInstrument): value is FrettedInstrument =>
  value === "guitar" || value === "ukulele"

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

const pickShape = ({ frets, fingers, barres, baseFret }: GuitarShape): GuitarShape => ({
  frets,
  fingers,
  barres,
  baseFret,
})

export interface GuitarVoicings {
  shapes: GuitarShape[]
  /** Note name of the slash bass the chord asked for, or null for a plain chord. */
  slashBass: string | null
  /** True when `shapes` is the exact slash voicing; false when it fell back. */
  slashApplied: boolean
}

/**
 * Fretted voicings for a chord, resolving slash chords (`C/G`, `Am7/E`) to the
 * dataset's dedicated voicing when it has one (roadmap #22). When the dataset
 * lacks the slash variant for the chord's quality the plain voicing is returned
 * with `slashApplied: false`, so the sheet can say so instead of quietly
 * showing the wrong bass note.
 */
export const findFrettedVoicings = (
  chord: string,
  instrument: FrettedInstrument,
): GuitarVoicings => {
  const parsed = parseChord(chord)
  if (!parsed.valid || parsed.rootIndex < 0) {
    return { shapes: [], slashBass: null, slashApplied: false }
  }
  const entries = FRETTED_DATA[instrument][DB_ROOT[parsed.rootIndex]] ?? []
  const mapped = ALIASES[parsed.quality] ?? parsed.quality
  const slashBass = parsed.bassIndex === null ? null : noteName(parsed.bassIndex, parsed.usesFlats)

  if (parsed.bassIndex !== null) {
    const isMinor = mapped === "minor" || mapped === "m"
    const isMajor = mapped === "major" || mapped === ""
    const slashSuffix = isMinor ? "m" : isMajor ? "" : null
    if (slashSuffix !== null) {
      for (const name of new Set([DB_BASS_SHARP[parsed.bassIndex], DB_BASS_FLAT[parsed.bassIndex]])) {
        const entry = entries.find((item) => item.suffix === `${slashSuffix}/${name}`)
        if (entry) {
          return { shapes: entry.positions.map(pickShape), slashBass, slashApplied: true }
        }
      }
    }
  }

  for (const candidate of [mapped, simplifyQuality(parsed.quality), "major"]) {
    if (candidate.length === 0) continue
    const entry = entries.find((item) => item.suffix === candidate)
    if (entry) {
      return { shapes: entry.positions.map(pickShape), slashBass, slashApplied: false }
    }
  }
  return { shapes: [], slashBass, slashApplied: false }
}

/** Guitar voicings for a chord, in the dataset's order (open shapes first). */
export const findGuitarVoicings = (chord: string): GuitarVoicings =>
  findFrettedVoicings(chord, "guitar")

/** Ukulele voicings for a chord, in the dataset's order (roadmap #24). */
export const findUkuleleVoicings = (chord: string): GuitarVoicings =>
  findFrettedVoicings(chord, "ukulele")

/**
 * Fretted voicings for a chord, in the dataset's order (open shapes first).
 * Returns an empty list for anything that is not a chord.
 */
export const findFrettedShapes = (chord: string, instrument: FrettedInstrument): GuitarShape[] =>
  findFrettedVoicings(chord, instrument).shapes

/** Guitar voicings for a chord, in the dataset's order (open shapes first). */
export const findGuitarShapes = (chord: string): GuitarShape[] => findFrettedShapes(chord, "guitar")

/** Ukulele voicings for a chord, in the dataset's order (open shapes first). */
export const findUkuleleShapes = (chord: string): GuitarShape[] =>
  findFrettedShapes(chord, "ukulele")

/**
 * Stable identity for a guitar voicing — the exact frets it holds (roadmap #23).
 * Unlike the position in the paged list, this survives a dataset that grows or
 * reorders its entries.
 */
export const guitarVoicingId = (shape: GuitarShape): string =>
  `${shape.baseFret}:${shape.frets.join(",")}`

/**
 * Moves the voicing matching `preferredId` to the front, leaving the rest in
 * dataset order, so the sheet opens on the pinned position (roadmap #23). An
 * absent or unknown id leaves the list untouched.
 */
export const orderGuitarVoicings = (
  shapes: GuitarShape[],
  preferredId?: string | null,
): GuitarShape[] => {
  if (!preferredId) return shapes
  const at = shapes.findIndex((shape) => guitarVoicingId(shape) === preferredId)
  if (at <= 0) return shapes
  const preferred = shapes[at]
  if (!preferred) return shapes
  return [preferred, ...shapes.slice(0, at), ...shapes.slice(at + 1)]
}

/** Preference key for a pinned voicing (`guitar:C` — roadmap #23). */
export const voicingPrefKey = (instrument: ChordInstrument, chord: string): string =>
  `${instrument}:${chord}`

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

/** Note name of a piano voicing's slash bass, or null when there is none. */
export const pianoBassName = (shape: PianoChordShape): string | null =>
  shape.bassIndex === null ? null : noteName(shape.bassIndex, shape.usesFlats)

export interface BassShape {
  /** Four strings, low E first: -1 muted, 0 open, 1+ the fret to hold. */
  frets: number[]
  /** Finger per string: 1 for anything held, 0 for an open or muted string. */
  fingers: number[]
  barres: number[]
  baseFret: number
}

/** Open pitch classes of a standard 4-string bass, low E first. */
const BASS_OPEN = [4, 9, 2, 7]
const BASS_STRINGS = 4
/**
 * The furthest fret worth showing. The four open strings sit five semitones
 * apart, so for any root one of them is always within three frets of it — this
 * cap is therefore never what makes a chord unreachable, it just keeps every
 * derived shape inside the five frets the diagram draws (roadmap #24).
 */
const BASS_MAX_FRET = 5

/** Fret at which `pitch` sits on `string`, or null when it is out of reach. */
const bassFret = (pitch: number, string: number): number | null => {
  const fret = (pitch - BASS_OPEN[string] + 12) % 12
  return fret <= BASS_MAX_FRET ? fret : null
}

/**
 * Bass position for a chord, derived from its spelling — `chords-db` carries
 * no bass dataset, and inventing one would mean shipping shapes nobody verified.
 *
 * What a bassist actually needs is where the root lives in one position and
 * which neighbouring string carries the fifth under it, so that is exactly what
 * this returns: the root on the lowest string that can reach it within
 * `BASS_MAX_FRET` — the register matters more than staying near the nut, which
 * is why a G is played on the low E rather than as the open high string — and
 * the fifth on an adjacent string when it lands within two frets of it, the
 * dyad played under a triad. A slash chord takes its bass note as the root,
 * which is what the slash means on this instrument.
 */
export const findBassChord = (chord: string): BassShape | null => {
  const parsed = parseChord(chord)
  if (!parsed.valid || parsed.rootIndex < 0) return null

  const root = parsed.bassIndex ?? parsed.rootIndex
  const intervals = CHORD_INTERVALS[simplifyQuality(parsed.quality)] ?? CHORD_INTERVALS.major
  const frets = new Array<number>(BASS_STRINGS).fill(-1)

  // Low string first: the root belongs under everything else.
  let rootString = -1
  let rootFret = 0
  for (let string = 0; string < BASS_STRINGS; string += 1) {
    const fret = bassFret(root, string)
    if (fret !== null) {
      rootString = string
      rootFret = fret
      break
    }
  }
  if (rootString < 0) return null
  frets[rootString] = rootFret

  if (intervals.includes(7)) {
    const fifth = (root + 7) % 12
    for (const string of [rootString - 1, rootString + 1]) {
      if (string < 0 || string >= BASS_STRINGS) continue
      const fret = bassFret(fifth, string)
      if (fret !== null && Math.abs(fret - rootFret) <= 2) {
        frets[string] = fret
        break
      }
    }
  }

  return {
    frets,
    fingers: frets.map((fret) => (fret > 0 ? 1 : 0)),
    barres: [],
    baseFret: 1,
  }
}

/**
 * Guitar shape to finger with the current capo: the displayed chord is what
 * the band plays, so the shape sits `capo` semitones below it (the capo raises
 * it back). With no capo the shape is the chord itself.
 */
export const capoShapeChord = (chord: string, capo: number): string =>
  capo > 0 ? transposeChord(chord, -capo) : chord.trim()

/* ---------------------------------------------------------------------------
 * Sounding pitches (roadmap #14 — "hear the chord")
 * ------------------------------------------------------------------------ */

/**
 * The midi pitches a displayed shape actually sounds. The dataset ships its
 * own `midi` per position; this math was verified against **all 4183 shipped
 * positions** (guitar + ukulele) before being written here, so it is not an
 * interpretation of the data — it reproduces it exactly:
 *
 * - a fret of `0` is the **open string** and never moves with `baseFret` (a
 *   high position may still let an open string ring);
 * - frets ≥ 1 are relative to `baseFret` (`absolute = fret + baseFret − 1`),
 *   which is also how `FretboardDiagram` spaces its dots, so sound and picture
 *   can never disagree;
 * - the capo adds its semitones: the sheet shows the shape to finger `capo`
 *   below the chord, and sounding pitches are that chord.
 */
const NOTE_TO_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Midi note of an `"E2"`-style name, or null for anything malformed. */
const openStringMidi = (name: string): number | null => {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(name)
  const letter = match?.[1]
  const octave = match?.[3]
  if (!letter || octave === undefined) return null
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0
  return (NOTE_TO_SEMITONE[letter] ?? 0) + accidental + (parseInt(octave, 10) + 1) * 12
}

/** Open-string midis per fretted instrument, read from the dataset's tunings. */
const OPEN_STRING_MIDIS: Record<FrettedInstrument, (number | null)[]> = {
  guitar: guitarData.tunings.standard.map(openStringMidi),
  ukulele: ukuleleData.tunings.standard.map(openStringMidi),
}

/** Open strings of a standard 4-string bass, low E first (E1 A1 D2 G2). */
const BASS_OPEN_MIDIS = [28, 33, 38, 43]

/** Sounding midi of one string, or null when the string is muted/unmapped. */
const stringMidi = (openMidi: number | null | undefined, fret: number, baseFret: number): number | null => {
  if (openMidi === null || openMidi === undefined || fret < 0) return null
  return openMidi + (fret === 0 ? 0 : fret + baseFret - 1)
}

/** Sounding midis of a displayed guitar/ukulele position (+ capo), muted strings dropped. */
export const frettedSoundingMidis = (
  shape: GuitarShape,
  instrument: FrettedInstrument,
  capo: number
): number[] => {
  const shift = Math.max(0, Math.round(capo))
  return shape.frets
    .map((fret, index) => stringMidi(OPEN_STRING_MIDIS[instrument][index], fret, shape.baseFret))
    .filter((midi): midi is number => midi !== null)
    .map((midi) => midi + shift)
}

/** Sounding midis of a derived bass position (+ capo), muted strings dropped. */
export const bassSoundingMidis = (shape: BassShape, capo: number): number[] => {
  const shift = Math.max(0, Math.round(capo))
  return shape.frets
    .map((fret, index) => stringMidi(BASS_OPEN_MIDIS[index], fret, shape.baseFret))
    .filter((midi): midi is number => midi !== null)
    .map((midi) => midi + shift)
}

/** Piano voicing floor for the chord tones; the slash bass sits an octave down. */
const PIANO_BASS_FLOOR = 36 // C2 — below it a preview turns to mud
const PIANO_CHORD_FLOOR = 48 // C3 — the register the diagram reads from

/** Smallest midi ≥ floor carrying `pitchClass`. */
const placeAbove = (pitchClass: number, floor: number): number =>
  floor + (((pitchClass - floor) % 12) + 12) % 12

/**
 * Piano voicing in sounding octaves: the slash bass (or nothing) anchors at
 * C2 or above, the chord stacks from C3 upward in root order — close position,
 * never below the bass floor.
 */
export const pianoSoundingMidis = (shape: PianoChordShape): number[] => {
  const midis: number[] = []
  if (shape.bassIndex !== null) midis.push(placeAbove(shape.bassIndex, PIANO_BASS_FLOOR))
  let floor = PIANO_CHORD_FLOOR
  for (const pitchClass of shape.pitchClasses) {
    const midi = placeAbove(pitchClass, floor)
    midis.push(midi)
    floor = midi + 1
  }
  return midis
}
