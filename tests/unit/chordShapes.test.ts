import { describe, expect, it } from "vitest"

import {
  capoShapeChord,
  findGuitarShapes,
  findPianoChord,
  pianoNoteNames,
} from "@/libs/chordShapes"

describe("guitar chord shapes", () => {
  it("finds voicings for the common chords", () => {
    expect(findGuitarShapes("C")[0]?.frets).toEqual([-1, 3, 2, 0, 1, 0])
    expect(findGuitarShapes("Am7")[0]?.frets).toEqual([-1, 0, 2, 0, 1, 0])
    expect(findGuitarShapes("G/B").length).toBeGreaterThan(0)
    expect(findGuitarShapes("C#m7b5").length).toBeGreaterThan(0)
    expect(findGuitarShapes("Bb").length).toBeGreaterThan(0)
  })

  it("falls back to a simpler shape when the suffix has no exact entry", () => {
    expect(findGuitarShapes("C7b13").length).toBeGreaterThan(0)
    expect(findGuitarShapes("F#maj7#11").length).toBeGreaterThan(0)
  })

  it("returns no shapes for text that is not a chord", () => {
    expect(findGuitarShapes("N.C.")).toEqual([])
    expect(findGuitarShapes("hello")).toEqual([])
  })

  it("subtracts the capo from the displayed chord", () => {
    expect(capoShapeChord("D", 2)).toBe("C")
    expect(capoShapeChord("G", 0)).toBe("G")
    expect(capoShapeChord("Am", 3)).toBe("F#m")
  })
})

describe("piano chord shapes", () => {
  it("derives the notes of major and seventh chords", () => {
    const c = findPianoChord("C")
    expect(c?.pitchClasses).toEqual([0, 4, 7])
    expect(c ? pianoNoteNames(c) : []).toEqual(["C", "E", "G"])

    const am7 = findPianoChord("Am7")
    expect(am7?.pitchClasses).toEqual([9, 0, 4, 7])
    expect(am7 ? pianoNoteNames(am7) : []).toEqual(["A", "C", "E", "G"])
  })

  it("keeps the slash bass and flat spelling", () => {
    const g = findPianoChord("G/B")
    expect(g?.bassIndex).toBe(11)
    const eb = findPianoChord("Ebmaj7")
    expect(eb ? pianoNoteNames(eb) : []).toEqual(["Eb", "G", "Bb", "D"])
  })

  it("returns null for text that is not a chord", () => {
    expect(findPianoChord("N.C.")).toBeNull()
    expect(findPianoChord("hello")).toBeNull()
  })
})
