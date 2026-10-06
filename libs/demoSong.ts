import type { LyricLine, SongSection } from "@/interfaces"
import { wordStarts } from "@/libs/chords"
import { createSection, sectionLabel } from "@/libs/songUtils"

/**
 * Deterministic id: even if two devices run the seed at the same time, the
 * sample can only ever exist once per band.
 */
export const DEMO_SONG_ID = "demo-welcome"

export const DEMO_SONG_TITLE = "Demo · así se ve una canción"

/** Lyric line whose chords are anchored to the Nth word (no manual offsets). */
const lineWithChords = (text: string, entries: [string, number][]): LyricLine => ({
  text,
  chords: entries.map(([chord, wordIndex]) => ({
    chord,
    position: wordStarts(text)[wordIndex] ?? 0,
  })),
})

/** Wordless line: a plain chord progression (intros, instrumentals, riffs). */
const chordLine = (chords: string[]): LyricLine => ({
  text: "",
  chords: chords.map((chord, position) => ({ chord, position })),
})

/**
 * Content of the sample song: it exercises every recent feature (minor-key
 * transposition from Em, chord progressions without lyrics, chords above
 * words, notes, tags and duration).
 */
export const demoSongSections = (): SongSection[] => [
  createSection("intro", sectionLabel("intro", 1), [chordLine(["Em", "C", "G", "D"])]),
  createSection("verse", sectionLabel("verse", 1), [
    lineWithChords("Esta es una canción de ejemplo", [
      ["Em", 0],
      ["C", 3],
    ]),
    lineWithChords("para que veas cómo se lee", [
      ["G", 0],
      ["D", 2],
    ]),
    lineWithChords("los acordes van sobre las palabras", [
      ["Em", 0],
      ["C", 2],
    ]),
    lineWithChords("y la intro solo lleva acordes", [
      ["G", 0],
      ["D", 3],
    ]),
  ]),
  createSection("chorus", sectionLabel("chorus", 1), [
    lineWithChords("No necesitas escribir de más", [
      ["Em", 0],
      ["C", 2],
    ]),
    lineWithChords("transpón, sube el capo o bájalo", [
      ["G", 0],
      ["D", 2],
    ]),
    lineWithChords("oculta los acordes si quieres", [
      ["Em", 0],
      ["C", 2],
    ]),
    lineWithChords("y esta demo se queda aquí", [
      ["G", 0],
      ["D", 4],
    ]),
  ]),
  createSection("instrumental", sectionLabel("instrumental", 1), [
    chordLine(["Am", "Em", "C", "D"]),
  ]),
]
