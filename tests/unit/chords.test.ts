import { describe, expect, it } from "vitest"

import {
  describeSemitones,
  diatonicChords,
  looksLikeChord,
  nextWordStart,
  normalizeChordInput,
  noteName,
  parseChord,
  parseKey,
  previousWordStart,
  semitonesBetweenKeys,
  snapToWordStart,
  transposeChord,
  transposeKey,
  wordStarts,
} from "@/libs/chords"

describe("parseChord", () => {
  it("splits a simple chord", () => {
    expect(parseChord("C")).toMatchObject({ root: "C", rootIndex: 0, quality: "", bass: null, valid: true })
  })

  it("keeps the quality suffix", () => {
    expect(parseChord("Csus4")).toMatchObject({ root: "C", quality: "sus4" })
    expect(parseChord("Am7")).toMatchObject({ root: "A", rootIndex: 9, quality: "m7" })
  })

  it("reads a slash chord's bass note", () => {
    expect(parseChord("F#m7/C")).toMatchObject({
      root: "F#",
      quality: "m7",
      bass: "C",
      bassIndex: 0,
      valid: true,
    })
  })

  it("remembers that flats were used so transposition keeps the spelling", () => {
    expect(parseChord("Bb")).toMatchObject({ root: "Bb", rootIndex: 10, usesFlats: true })
    expect(parseChord("A#")).toMatchObject({ root: "A#", rootIndex: 10, usesFlats: false })
  })

  it("rejects text that is not a chord", () => {
    expect(parseChord("N.C.")).toMatchObject({ valid: false, rootIndex: -1 })
    expect(parseChord("hello").valid).toBe(false)
  })
})

describe("transposeChord", () => {
  it("moves a chord up and down", () => {
    expect(transposeChord("C", 1)).toBe("C#")
    expect(transposeChord("C", 11)).toBe("B")
  })

  it("keeps the spelling the musician wrote", () => {
    // A sharp-rooted chord stays sharp-rooted, a flat-rooted one stays flat.
    expect(transposeChord("A", -1)).toBe("G#")
    expect(transposeChord("Db", 2)).toBe("Eb")
  })

  it("keeps the quality", () => {
    expect(transposeChord("Am", -1)).toBe("G#m")
    expect(transposeChord("G7", 2)).toBe("A7")
  })

  it("keeps flats flat and sharps sharp", () => {
    expect(transposeChord("Bb", 2)).toBe("C")
    expect(transposeChord("A#", 2)).toBe("C")
  })

  it("moves the slash bass note too", () => {
    expect(transposeChord("F#m7/C", 2)).toBe("G#m7/D")
  })

  it("wraps around the octave in both directions", () => {
    expect(transposeChord("B", 1)).toBe("C")
    expect(transposeChord("C", -1)).toBe("B")
  })

  it("returns the original key untouched when nothing changes", () => {
    expect(transposeChord("Am", 0)).toBe("Am")
  })

  it("leaves unparseable values alone", () => {
    expect(transposeChord("N.C.", 3)).toBe("N.C.")
    expect(transposeChord("  ", 3)).toBe("")
  })
})

describe("keys", () => {
  it("parses major and minor labels", () => {
    expect(parseKey("G")).toMatchObject({ rootIndex: 7, minor: false, valid: true })
    // Am is described from its relative major root.
    expect(parseKey("Am")).toMatchObject({ rootIndex: 0, minor: true, valid: true })
    // Bb minor is described from its relative major, Db.
    expect(parseKey("Bbm")).toMatchObject({ rootIndex: 1, minor: true, valid: true })
  })

  it("rejects a nonsense key", () => {
    expect(parseKey("H").valid).toBe(false)
  })

  it("measures the distance between keys", () => {
    expect(semitonesBetweenKeys("C", "D")).toBe(2)
    expect(semitonesBetweenKeys("D", "C")).toBe(-2)
    expect(semitonesBetweenKeys("C", "H")).toBe(0)
  })

  it("transposes keys while preserving major/minor and spelling", () => {
    expect(transposeKey("C", 2)).toBe("D")
    expect(transposeKey("Am", 2)).toBe("Dm")
    expect(transposeKey("Bb", 2)).toBe("C")
    expect(transposeKey("C", 0)).toBe("C")
    expect(transposeKey("nonsense", 3)).toBe("nonsense")
  })

  it("describes the shift in words", () => {
    expect(describeSemitones(0)).toBe("Original key")
    expect(describeSemitones(1)).toBe("1 semitone up")
    expect(describeSemitones(-3)).toBe("3 semitones down")
  })

  it("names every semitone", () => {
    expect(noteName(0)).toBe("C")
    expect(noteName(12)).toBe("C")
    expect(noteName(-1)).toBe("B")
    expect(noteName(6, true)).toBe("Gb")
  })
})

describe("diatonicChords", () => {
  it("lists the major scale triads", () => {
    expect(diatonicChords("C")).toEqual(["C", "Dm", "Em", "F", "G", "Am", "Bdim"])
    expect(diatonicChords("G")).toEqual(["G", "Am", "Bm", "C", "D", "Em", "F#dim"])
  })

  it("lists the natural minor triads from the minor tonic", () => {
    expect(diatonicChords("Am")).toEqual(["Am", "Bdim", "C", "Dm", "Em", "F", "G"])
  })

  it("returns nothing for an invalid key", () => {
    expect(diatonicChords("H")).toEqual([])
  })
})

describe("chord input normalisation", () => {
  it("tidies what the user typed", () => {
    expect(normalizeChordInput("eb")).toBe("Eb")
    expect(normalizeChordInput("c#m7")).toBe("C#m7")
    expect(normalizeChordInput("  f#m7/c ")).toBe("F#m7/C")
    expect(normalizeChordInput("")).toBe("")
  })

  it("leaves half-typed text untouched", () => {
    expect(normalizeChordInput("hello")).toBe("hello")
  })

  it("recognises chords", () => {
    expect(looksLikeChord("Am7")).toBe(true)
    expect(looksLikeChord("Bbmaj7")).toBe(true)
    expect(looksLikeChord("")).toBe(false)
    expect(looksLikeChord("A".repeat(13))).toBe(false)
  })
})

describe("word snapping", () => {
  const line = "Hello world  foo"

  it("finds every word start", () => {
    expect(wordStarts(line)).toEqual([0, 6, 13])
    expect(wordStarts("   ")).toEqual([])
  })

  it("snaps backwards to the nearest word start", () => {
    expect(snapToWordStart("Hello world", 8)).toBe(6)
    expect(snapToWordStart("Hello world", 0)).toBe(0)
    expect(snapToWordStart("", 3)).toBe(0)
  })

  it("walks forwards and backwards one word at a time", () => {
    expect(nextWordStart("Hello world", 3)).toBe(6)
    expect(nextWordStart("Hello world", 6)).toBe("Hello world".length)
    expect(previousWordStart("Hello world", 8)).toBe(6)
    expect(previousWordStart("Hello world", 0)).toBe(0)
  })
})