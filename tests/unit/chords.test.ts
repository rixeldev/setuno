import { describe, expect, it } from "vitest"

import {
  COMMON_CHORDS,
  collectSongChords,
  describeSemitones,
  diatonicChords,
  displayChord,
  displayKey,
  displayNote,
  isRecognizedChord,
  looksLikeChord,
  nashvilleChord,
  nashvilleDegree,
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
    expect(transposeKey("Bb", 2)).toBe("C")
    expect(transposeKey("C", 0)).toBe("C")
    expect(transposeKey("nonsense", 3)).toBe("nonsense")
  })

  it("moves minor keys semitone by semitone from their own tonic", () => {
    // Regression: the tonic was taken from the relative major, so Em +1 landed
    // on Abm and Em -1 on Gbm instead of the neighbouring minor keys.
    expect(transposeKey("Em", 1)).toBe("Fm")
    expect(transposeKey("Em", -1)).toBe("Ebm")
    expect(transposeKey("Am", 2)).toBe("Bm")
    expect(transposeKey("Am", -1)).toBe("Abm")
    expect(transposeKey("F#m", 1)).toBe("Gm")
    expect(transposeKey("F#m", -1)).toBe("Fm")
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

describe("COMMON_CHORDS", () => {
  it("only offers chords the parser accepts", () => {
    for (const chord of COMMON_CHORDS) {
      expect(looksLikeChord(chord), `"${chord}" should be a valid chord`).toBe(true)
      expect(isRecognizedChord(chord), `"${chord}" should be recognised`).toBe(true)
    }
  })

  it("covers the roots and shapes players reach for", () => {
    expect(COMMON_CHORDS).toEqual(
      expect.arrayContaining([
        "C#m",
        "F#m",
        "Bbm",
        "Ebm",
        "G#m",
        "D5",
        "Bm7",
        "Cmaj7",
        "Asus2",
        "Csus4",
        "Cadd9",
        "Bdim",
        "Eaug",
        "Bm7b5",
        "G/B",
      ]),
    )
  })

  it("has no duplicates", () => {
    expect(new Set(COMMON_CHORDS).size).toBe(COMMON_CHORDS.length)
  })
})

describe("chord notation", () => {
  it("keeps the american letters when asked", () => {
    expect(displayChord("F#m7", "letters")).toBe("F#m7")
    expect(displayKey("Em", "letters")).toBe("Em")
  })

  it("spells chords in solfège", () => {
    expect(displayChord("C", "solfege")).toBe("Do")
    expect(displayChord("F#m7", "solfege")).toBe("Fa#m7")
    expect(displayChord("Bbmaj7", "solfege")).toBe("Sibmaj7")
    expect(displayChord("G/B", "solfege")).toBe("Sol/Si")
    expect(displayChord("Am7", "solfege")).toBe("Lam7")
  })

  it("spells keys in solfège, dropping the 'm' spelling variant", () => {
    expect(displayKey("C", "solfege")).toBe("Do")
    expect(displayKey("Em", "solfege")).toBe("Mim")
    expect(displayKey("Bb", "solfege")).toBe("Sib")
    expect(displayKey("nonsense", "solfege")).toBe("nonsense")
  })

  it("leaves anything that is not a chord untouched", () => {
    expect(displayChord("N.C.", "solfege")).toBe("N.C.")
    expect(displayChord("", "solfege")).toBe("")
  })
})

describe("nashville notation", () => {
  it("numbers the diatonic scale 1..7", () => {
    expect(nashvilleDegree(0)).toBe("1")
    expect(nashvilleDegree(2)).toBe("2")
    expect(nashvilleDegree(4)).toBe("3")
    expect(nashvilleDegree(5)).toBe("4")
    expect(nashvilleDegree(7)).toBe("5")
    expect(nashvilleDegree(9)).toBe("6")
    expect(nashvilleDegree(11)).toBe("7")
  })

  it("gives chromatic degrees a flat or sharp", () => {
    expect(nashvilleDegree(1)).toBe("b2")
    expect(nashvilleDegree(3)).toBe("b3")
    expect(nashvilleDegree(6)).toBe("#4")
    expect(nashvilleDegree(8)).toBe("b6")
    expect(nashvilleDegree(10)).toBe("b7")
    // Wraps in both directions.
    expect(nashvilleDegree(12)).toBe("1")
    expect(nashvilleDegree(-1)).toBe("7")
  })

  it("reads a chord as a degree relative to the key", () => {
    expect(nashvilleChord("G", "G")).toBe("1")
    expect(nashvilleChord("C", "G")).toBe("4")
    expect(nashvilleChord("D", "G")).toBe("5")
    expect(nashvilleChord("Em", "G")).toBe("6m")
    expect(nashvilleChord("Am", "C")).toBe("6m")
    expect(nashvilleChord("F", "G")).toBe("b7")
    expect(nashvilleChord("F#m7b5", "G")).toBe("7m7b5")
    expect(nashvilleChord("G/B", "G")).toBe("1/3")
  })

  it("keeps the minor key's own tonic as 1", () => {
    expect(nashvilleChord("Am", "Am")).toBe("1m")
    expect(nashvilleChord("C", "Am")).toBe("b3")
    expect(nashvilleChord("Em", "Am")).toBe("5m")
    expect(nashvilleChord("G", "Am")).toBe("b7")
  })

  it("falls back to letters without a key", () => {
    expect(nashvilleChord("G", "")).toBeNull()
    expect(nashvilleChord("G", "nonsense")).toBeNull()
    expect(displayChord("G", "nashville")).toBe("G")
    expect(displayChord("G", "nashville", "G")).toBe("1")
    expect(displayChord("N.C.", "nashville", "G")).toBe("N.C.")
  })

  it("never renames a key", () => {
    expect(displayKey("G", "nashville")).toBe("G")
    expect(displayKey("Em", "nashville")).toBe("Em")
  })

  it("spells single notes as degrees when the key is known", () => {
    expect(displayNote("B", "nashville", "G")).toBe("3")
    expect(displayNote("F", "nashville", "G")).toBe("b7")
    expect(displayNote("B", "nashville")).toBe("B")
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

describe("isRecognizedChord", () => {
  it("accepts the chord vocabulary", () => {
    for (const chord of ["C", "F#m7", "Bbmaj7", "G/B", "Am7b5", "C7sus4", "Dadd9", "E6/9", "Csus2"]) {
      expect(isRecognizedChord(chord), `"${chord}" should be recognised`).toBe(true)
    }
  })

  it("rejects solfège, Nashville and German notation", () => {
    expect(isRecognizedChord("Do")).toBe(false)
    expect(isRecognizedChord("Lam")).toBe(false)
    expect(isRecognizedChord("IV")).toBe(false)
    expect(isRecognizedChord("Hm")).toBe(false)
    expect(isRecognizedChord("Bla")).toBe(false)
  })

  it("rejects a slash chord whose bass is not a note", () => {
    expect(isRecognizedChord("C/H")).toBe(false)
    expect(isRecognizedChord("G/B")).toBe(true)
  })
})

describe("collectSongChords", () => {
  it("splits recognised and unrecognised chords", () => {
    const line = (chords: string[]) => ({
      text: "la",
      chords: chords.map((chord, position) => ({ chord, position })),
    })
    const section = {
      id: "sec",
      type: "verse" as const,
      label: "Verse 1",
      lines: [line(["C", "Do"]), line(["G/B", "Hm"])],
    }
    const { recognized, unrecognized } = collectSongChords([section])
    expect(recognized).toEqual(["C", "G/B"])
    expect(unrecognized).toEqual(["Do", "Hm"])
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