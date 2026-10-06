import type { ChordNotation } from "@/interfaces/user"

/**
 * Chord + key utilities: parsing, transposition and helpers used by the
 * chord/lyric editor and the song reader.
 *
 * Transposition is always a *presentation* concern: the original song data is
 * never mutated when a user only changes the displayed key (docs §11).
 */

const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const

const ACCIDENTAL_OFFSET: Record<string, number> = {
  "": 0,
  "#": 1,
  "♯": 1,
  b: -1,
  "♭": -1,
  x: 2,
}

/** The 12 major key labels offered in pickers. */
export const MAJOR_KEYS = SHARP_NAMES
/** The 12 minor key labels offered in pickers. */
export const MINOR_KEYS = FLAT_NAMES.map((name) => `${name}m`)

export interface ParsedChord {
  /** Normalised root note ("C", "F#", "Bb"). */
  root: string
  /** Semitone index 0-11 of the root. */
  rootIndex: number
  /** Everything after the root: "m7", "sus4", "add9"... */
  quality: string
  /** Slash-chord bass note, when present. */
  bass: string | null
  bassIndex: number | null
  /** True when the chord was written with flats. */
  usesFlats: boolean
  valid: boolean
}

const ROOT_PATTERN = /^([A-Ga-g])([#♯b♭x]{0,2})(.*)$/
const BASS_PATTERN = /^([A-Ga-g])([#♯b♭x]{0,2})$/

const normaliseAccidental = (raw: string): string => {
  let value = raw.replace("♯", "#").replace("♭", "b")
  let offset = 0
  for (const char of value) offset += ACCIDENTAL_OFFSET[char] ?? 0
  return offset >= 0 ? "#".repeat(offset) : "b".repeat(Math.abs(offset))
}

/** Splits a chord into root, quality and slash-bass parts. */
export const parseChord = (chord: string): ParsedChord => {
  const trimmed = chord.trim()
  const match = ROOT_PATTERN.exec(trimmed)
  if (!match) {
    return {
      root: trimmed,
      rootIndex: -1,
      quality: "",
      bass: null,
      bassIndex: null,
      usesFlats: false,
      valid: false,
    }
  }

  const [, letter = "", accidentalRaw = "", rest = ""] = match
  const accidental = normaliseAccidental(accidentalRaw)
  const letterSemitone = LETTER_SEMITONES[letter.toUpperCase()] ?? 0
  const rootIndex = (((letterSemitone + (ACCIDENTAL_OFFSET[accidental] ?? 0)) % 12) + 12) % 12
  const usesFlats = accidental.startsWith("b")

  // Split the trailing "/bass" (slash chords) from the quality suffix.
  const slashIndex = rest.indexOf("/")
  const quality = slashIndex === -1 ? rest : rest.slice(0, slashIndex)
  const bassRaw = slashIndex === -1 ? "" : rest.slice(slashIndex + 1)
  const bassMatch = BASS_PATTERN.exec(bassRaw.trim())

  const bass = bassMatch ? `${bassMatch[1]}${normaliseAccidental(bassMatch[2] ?? "")}` : null
  let bassIndex: number | null = null
  if (bassMatch) {
    const bassSemitone = LETTER_SEMITONES[(bassMatch[1] ?? "C").toUpperCase()] ?? 0
    bassIndex =
      (((bassSemitone + (ACCIDENTAL_OFFSET[normaliseAccidental(bassMatch[2] ?? "")] ?? 0)) % 12) + 12) % 12
  }

  return {
    root: `${letter.toUpperCase()}${accidental}`,
    rootIndex,
    quality,
    bass,
    bassIndex,
    usesFlats,
    valid: true,
  }
}

/** Returns the note name for a (possibly out of range) semitone index. */
export const noteName = (index: number, preferFlats = false): string => {
  const normalised = ((Math.round(index) % 12) + 12) % 12
  return preferFlats ? (FLAT_NAMES[normalised] as string) : (SHARP_NAMES[normalised] as string)
}

/**
 * Transposes a single chord by the given number of semitones.
 * Unparseable values (e.g. "N.C.") are returned untouched.
 */
export const transposeChord = (chord: string, semitones: number): string => {
  const trimmed = chord.trim()
  if (!trimmed || semitones === 0) return trimmed
  const parsed = parseChord(trimmed)
  if (!parsed.valid) return trimmed

  const root = noteName(parsed.rootIndex + semitones, parsed.usesFlats)
  const bass =
    parsed.bass && parsed.bassIndex !== null
      ? `/${noteName(parsed.bassIndex + semitones, parsed.usesFlats)}`
      : ""
  return `${root}${parsed.quality}${bass}`
}

export interface ParsedKey {
  label: string
  /** Root index adjusted for the mode (minor roots sit 3 semitones higher). */
  rootIndex: number
  minor: boolean
  valid: boolean
}

/** Parses a key label such as "G", "Bb" or "F#m". */
export const parseKey = (key: string): ParsedKey => {
  const trimmed = key.trim()
  const match = /^([A-Ga-g])([#♯b♭]{0,2})(m|min)?$/.exec(trimmed)
  if (!match) {
    return { label: trimmed, rootIndex: -1, minor: false, valid: false }
  }
  const [, letter = "", accidentalRaw = "", mode = ""] = match
  const accidental = normaliseAccidental(accidentalRaw)
  const minor = mode.length > 0
  const letterSemitone = LETTER_SEMITONES[letter.toUpperCase()] ?? 0
  const base = (letterSemitone + (ACCIDENTAL_OFFSET[accidental] ?? 0) + (minor ? 3 : 0)) % 12
  return {
    label: trimmed,
    rootIndex: ((base % 12) + 12) % 12,
    minor,
    valid: true,
  }
}

/** Semitones needed to move from one key to another (negative = down). */
export const semitonesBetweenKeys = (fromKey: string, toKey: string): number => {
  const from = parseKey(fromKey)
  const to = parseKey(toKey)
  if (!from.valid || !to.valid) return 0
  return to.rootIndex - from.rootIndex
}

/** Moves a key label by a number of semitones, keeping major/minor spelling. */
export const transposeKey = (key: string, semitones: number): string => {
  const parsed = parseKey(key)
  if (!parsed.valid || semitones === 0) return key.trim()
  // `parseKey` stores minor roots three semitones up (their relative major) so
  // the diatonic helpers can share the major table. Naming the transposed note
  // needs the actual tonic, otherwise a minor key would jump a third every step
  // (Em +1 landing on Abm instead of Fm).
  const tonic = parsed.minor ? parsed.rootIndex - 3 : parsed.rootIndex
  const prefersFlats = parsed.minor || parsed.label.includes("b")
  const name = noteName(tonic + semitones, prefersFlats)
  return parsed.minor ? `${name}m` : name
}

/** Human readable label such as "+2 semitones" / "-1 semitone". */
export const describeSemitones = (semitones: number): string => {
  if (semitones === 0) return "Original key"
  const direction = semitones > 0 ? "up" : "down"
  const amount = Math.abs(semitones)
  return `${amount} semitone${amount === 1 ? "" : "s"} ${direction}`
}

/** Solfège names for the natural notes, used by the latin notation. */
const SOLFEGE_NAMES: Record<string, string> = {
  C: "Do",
  D: "Re",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Si",
}

/** Spells a single note ("C#", "Bb") in the chosen notation. */
export const displayNote = (note: string, notation: ChordNotation): string => {
  if (notation === "letters") return note
  const name = SOLFEGE_NAMES[note.charAt(0).toUpperCase()]
  return name ? `${name}${note.slice(1)}` : note
}

/**
 * Spells a chord in the chosen notation. Stored chords always use letters, so
 * this is a display-only conversion ("F#m7/C#" -> "Fa#m7/Do#").
 */
export const displayChord = (chord: string, notation: ChordNotation = "letters"): string => {
  if (notation === "letters") return chord
  const parsed = parseChord(chord)
  if (!parsed.valid) return chord
  const bass = parsed.bass ? `/${displayNote(parsed.bass, notation)}` : ""
  return `${displayNote(parsed.root, notation)}${parsed.quality}${bass}`
}

/** Spells a key label in the chosen notation ("Em" -> "Mim", "Bb" -> "Sib"). */
export const displayKey = (key: string, notation: ChordNotation = "letters"): string => {
  if (notation === "letters") return key
  const match = /^([A-G][#♯b♭]{0,2})(m|min)?$/.exec(key.trim())
  if (!match) return key
  return `${displayNote(match[1] ?? "", notation)}${match[2] ? "m" : ""}`
}

/**
 * Quick-pick chord palette used by the editor chord pad. Grouped from the most
 * common shapes (triads) to the specialised ones, and spelled the way bands
 * write them (both F#/Gb and C#/Db, flats for the rest).
 */
export const COMMON_CHORDS: string[] = [
  // Major triads.
  "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B",
  // Minor triads.
  "Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm",
  // Power chords.
  "C5", "D5", "E5", "F5", "F#5", "G5", "A5", "B5",
  // Dominant sevenths.
  "C7", "D7", "E7", "F7", "F#7", "G7", "A7", "Bb7", "B7",
  // Minor sevenths.
  "Am7", "Bm7", "Cm7", "C#m7", "Dm7", "Em7", "Fm7", "F#m7", "Gm7", "Bbm7",
  // Major sevenths.
  "Cmaj7", "Dmaj7", "Ebmaj7", "Emaj7", "Fmaj7", "F#maj7", "Gmaj7", "Amaj7", "Bbmaj7", "Bmaj7",
  // Suspended second / fourth.
  "Asus2", "Asus4", "Bsus4", "Csus2", "Csus4", "Dsus2", "Dsus4", "Esus4",
  "Fsus2", "Fsus4", "Gsus2", "Gsus4",
  // Added ninths and sixths.
  "Cadd9", "Dadd9", "Eadd9", "Fadd9", "Gadd9", "Aadd9", "Badd9",
  "C6", "D6", "E6", "G6", "A6",
  // Diminished, augmented and half diminished.
  "Bdim", "Cdim", "Ddim", "Edim", "Fdim", "Gdim", "Adim",
  "Caug", "Eaug", "Gaug", "Aaug",
  "Am7b5", "Bm7b5", "Cm7b5", "Dm7b5", "Em7b5", "F#m7b5", "Gm7b5",
  // Slash chords (bass note under the chord).
  "C/E", "C/G", "D/F#", "D/A", "E/G#", "F/A", "G/B", "A/C#", "Am/G", "G/D",
]

const MAJOR_DEGREES = [
  { degree: "I", semitone: 0, quality: "" },
  { degree: "ii", semitone: 2, quality: "m" },
  { degree: "iii", semitone: 4, quality: "m" },
  { degree: "IV", semitone: 5, quality: "" },
  { degree: "V", semitone: 7, quality: "" },
  { degree: "vi", semitone: 9, quality: "m" },
  { degree: "vii", semitone: 11, quality: "dim" },
] as const

const MINOR_DEGREES = [
  { degree: "i", semitone: 0, quality: "m" },
  { degree: "ii", semitone: 2, quality: "dim" },
  { degree: "III", semitone: 3, quality: "" },
  { degree: "iv", semitone: 5, quality: "m" },
  { degree: "v", semitone: 7, quality: "m" },
  { degree: "VI", semitone: 8, quality: "" },
  { degree: "VII", semitone: 10, quality: "" },
] as const

/**
 * Diatonic chords for a key, used by the "suggest chords for this key" helper
 * in the editor.
 */
export const diatonicChords = (key: string): string[] => {
  const parsed = parseKey(key)
  if (!parsed.valid) return []
  // Minor keys are described by their relative major root.
  const rootIndex = parsed.minor ? parsed.rootIndex - 3 : parsed.rootIndex
  const degrees = parsed.minor ? MINOR_DEGREES : MAJOR_DEGREES
  const preferFlats = parsed.minor || parsed.label.includes("b")
  return degrees.map(
    (entry) => `${noteName(rootIndex + entry.semitone, preferFlats)}${entry.quality}`,
  )
}

/** True when the value looks like a chord rather than free text. */
export const looksLikeChord = (value: string): boolean => {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 12) return false
  return parseChord(trimmed).valid
}

/**
 * Normalises user input while typing a chord ("eb" -> "Eb", "c#m7" -> "C#m7").
 * Returns an empty string for values that are not chords yet.
 */
export const normalizeChordInput = (value: string): string => {
  const trimmed = value.trim().replace(/\s+/g, "")
  if (trimmed.length === 0) return ""
  const parsed = parseChord(trimmed)
  if (!parsed.valid) return trimmed
  const bass = parsed.bass && parsed.bassIndex !== null ? `/${noteName(parsed.bassIndex, parsed.usesFlats)}` : ""
  return `${parsed.root}${parsed.quality}${bass}`
}

/**
 * Finds the word boundaries of a lyric line so chords can snap to words.
 * Returns the character offset of every word start.
 */
export const wordStarts = (text: string): number[] => {
  const starts: number[] = []
  let inWord = false
  for (let index = 0; index < text.length; index += 1) {
    const isSpace = /\s/.test(text[index] ?? " ")
    if (!isSpace && !inWord) {
      starts.push(index)
      inWord = true
    } else if (isSpace) {
      inWord = false
    }
  }
  return starts
}

/** Offset of the closest word start at or before `position`. */
export const snapToWordStart = (text: string, position: number): number => {
  const starts = wordStarts(text)
  if (starts.length === 0) return 0
  const clamped = Math.max(0, Math.min(position, text.length))
  let best = starts[0] as number
  for (const start of starts) {
    if (start <= clamped) best = start
    else break
  }
  return best
}

/** Offset of the next word start after `position` (used when moving a chord). */
export const nextWordStart = (text: string, position: number): number => {
  const starts = wordStarts(text)
  const next = starts.find((start) => start > position)
  return next ?? text.length
}

/** Offset of the previous word start before `position` (chord moves). */
export const previousWordStart = (text: string, position: number): number => {
  const starts = wordStarts(text)
  const earlier = starts.filter((start) => start < position)
  return earlier.length > 0 ? (earlier[earlier.length - 1] as number) : 0
}