import { describe, expect, it } from "vitest"

import {
  capoShapeChord,
  findGuitarShapes,
  findGuitarVoicings,
  findPianoChord,
  guitarVoicingId,
  orderGuitarVoicings,
  pianoBassName,
  pianoNoteNames,
  voicingPrefKey,
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

  it("names the slash bass only when there is one", () => {
    const g = findPianoChord("G/B")
    expect(g ? pianoBassName(g) : null).toBe("B")
    const c = findPianoChord("C")
    expect(c ? pianoBassName(c) : null).toBeNull()
  })
})

describe("slash voicings", () => {
  it("uses the dataset's exact slash voicing when it exists", () => {
    const result = findGuitarVoicings("G/B")
    expect(result.slashBass).toBe("B")
    expect(result.slashApplied).toBe(true)
    expect(result.shapes.length).toBeGreaterThan(0)
  })

  it("falls back and flags the missing slash variant", () => {
    const result = findGuitarVoicings("G7/B")
    expect(result.slashBass).toBe("B")
    expect(result.slashApplied).toBe(false)
    expect(result.shapes.length).toBeGreaterThan(0)
  })

  it("has no slash bass for a plain chord", () => {
    const result = findGuitarVoicings("C")
    expect(result.slashBass).toBeNull()
    expect(result.slashApplied).toBe(false)
  })

  it("returns nothing for text that is not a chord", () => {
    expect(findGuitarVoicings("hello").shapes).toEqual([])
  })
})

describe("preferred voicings", () => {
  it("derives a stable id from the exact frets", () => {
    const [shape] = findGuitarShapes("C")
    expect(shape).toBeDefined()
    if (!shape) return
    expect(guitarVoicingId(shape)).toBe(`${shape.baseFret}:${shape.frets.join(",")}`)
    // The same shape always yields the same id, whatever its position.
    expect(guitarVoicingId(shape)).toBe(guitarVoicingId({ ...shape }))
  })

  it("moves the pinned voicing to the front, keeping the rest in order", () => {
    const shapes = findGuitarShapes("C")
    expect(shapes.length).toBeGreaterThan(1)
    const target = shapes[2]
    if (!target) return
    const ordered = orderGuitarVoicings(shapes, guitarVoicingId(target))
    expect(ordered[0]).toEqual(target)
    expect(ordered).toHaveLength(shapes.length)
    // Every original shape is still present exactly once.
    expect(new Set(ordered.map(guitarVoicingId)).size).toBe(shapes.length)
  })

  it("leaves the list untouched without a pin or with an unknown id", () => {
    const shapes = findGuitarShapes("C")
    expect(orderGuitarVoicings(shapes, null)).toBe(shapes)
    expect(orderGuitarVoicings(shapes, "no-such-id")).toBe(shapes)
    // Pinning the shape that is already first is a no-op.
    const first = shapes[0]
    if (first) expect(orderGuitarVoicings(shapes, guitarVoicingId(first))).toBe(shapes)
  })

  it("keys the preference by instrument and chord", () => {
    expect(voicingPrefKey("guitar", "C")).toBe("guitar:C")
    expect(voicingPrefKey("piano", "G/B")).toBe("piano:G/B")
  })
})
