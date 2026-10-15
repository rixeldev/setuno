import { describe, expect, it } from "vitest"

import guitarData from "@tombatossals/chords-db/lib/guitar.json"
import ukuleleData from "@tombatossals/chords-db/lib/ukulele.json"

import {
  bassSoundingMidis,
  capoShapeChord,
  findBassChord,
  findGuitarShapes,
  findGuitarVoicings,
  findPianoChord,
  findUkuleleShapes,
  findUkuleleVoicings,
  frettedSoundingMidis,
  guitarVoicingId,
  orderGuitarVoicings,
  pianoBassName,
  pianoNoteNames,
  pianoSoundingMidis,
  voicingPrefKey,
} from "@/libs/chordShapes"
import type { GuitarShape } from "@/libs/chordShapes"

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

describe("ukulele chord shapes", () => {
  it("draws four strings, not six", () => {
    const shape = findUkuleleShapes("C")[0]
    expect(shape?.frets).toHaveLength(4)
    expect(shape?.frets).toEqual([0, 0, 0, 3])
  })

  it("finds voicings for chords guitar shapes differently", () => {
    expect(findUkuleleShapes("G").length).toBeGreaterThan(0)
    expect(findUkuleleShapes("Am").length).toBeGreaterThan(0)
    // The dataset is smaller than guitar's, so it can miss an exotic suffix —
    // it must fall back rather than come back empty.
    expect(findUkuleleShapes("C7b13").length).toBeGreaterThan(0)
  })

  it("falls back to the plain voicing when the dataset has no slash entry", () => {
    // chords-db ships no slash suffixes for ukulele at all, so the bass note is
    // still reported — the sheet is expected to say so — over the plain shape.
    const voicings = findUkuleleVoicings("C/G")
    expect(voicings.slashBass).toBe("G")
    expect(voicings.slashApplied).toBe(false)
    expect(voicings.shapes.length).toBeGreaterThan(0)
  })

  it("returns nothing for text that is not a chord", () => {
    expect(findUkuleleShapes("hello")).toEqual([])
  })
})

describe("bass positions", () => {
  it("puts the root under the fifth, on the lowest string that reaches it", () => {
    // C is not on the low E within five frets, so it moves up to the A string,
    // and G lands beside it rather than on the open high string.
    expect(findBassChord("C")?.frets).toEqual([3, 3, -1, -1])
    expect(findBassChord("G")?.frets).toEqual([3, 5, -1, -1])
    expect(findBassChord("E")?.frets).toEqual([0, 2, -1, -1])
  })

  it("plays the bass note of a slash chord as the root", () => {
    expect(findBassChord("C/G")?.frets).toEqual(findBassChord("G")?.frets)
  })

  it("drops the fifth for a chord that has none", () => {
    // C sits on the A string (its low-E position is fret 8, out of reach), and
    // a dim has no fifth, so nothing lands beside it.
    expect(findBassChord("Cdim")?.frets).toEqual([-1, 3, -1, -1])
  })

  it("never asks for a fret the diagram cannot draw", () => {
    for (let pitch = 0; pitch < 12; pitch += 1) {
      const root = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][pitch]
      const shape = findBassChord(`${root}m7`)
      expect(shape).not.toBeNull()
      expect(shape?.frets).toHaveLength(4)
      for (const fret of shape?.frets ?? []) {
        expect(fret).toBeGreaterThanOrEqual(-1)
        expect(fret).toBeLessThanOrEqual(5)
      }
    }
  })

  it("marks every string the shape does not use", () => {
    const frets = findBassChord("C")?.frets ?? []
    expect(frets.filter((fret) => fret === -1).length).toBe(2)
  })

  it("returns nothing for text that is not a chord", () => {
    expect(findBassChord("hello")).toBeNull()
    expect(findBassChord("N.C.")).toBeNull()
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

/* -------------------------------------------------------------------------
 * Sounding pitches (roadmap #14 — "hear the chord"): what the shape the sheet
 * shows actually plays.
 * ---------------------------------------------------------------------- */

describe("sounding midis", () => {
  it("sounds the displayed guitar shape, muted strings dropped", () => {
    const [shape] = findGuitarShapes("C")
    expect(shape).toBeDefined()
    if (!shape) return
    // C3 E3 G3 C4 E4 — the low E is muted, every other string rings.
    expect(frettedSoundingMidis(shape, "guitar", 0)).toEqual([48, 52, 55, 60, 64])
    // With a capo the sheet shows the shape two semitones down; sounding
    // pitches are the chord the band plays, so the capo adds itself back.
    expect(frettedSoundingMidis(shape, "guitar", 2)).toEqual([50, 54, 57, 62, 66])
  })

  it("treats fret 0 as the open string even deep up the neck", () => {
    // The dataset lets an open string ring under a high position. A naive
    // "relative to baseFret" shift would drag this D up six semitones — the
    // open string must not move.
    const shape = findGuitarShapes("Csus4").find((item) => item.frets.join(",") === "3,3,-1,0,1,3")
    expect(shape).toBeDefined()
    if (!shape) return
    expect(shape.baseFret).toBeGreaterThan(1)
    expect(frettedSoundingMidis(shape, "guitar", 0)).toEqual([48, 53, 55, 65, 72])
  })

  it("reproduces the dataset's own midi for every shipped position", () => {
    // The dataset ships a `midi` array per position. This derivation was
    // written from the fret rules the diagram draws by — pinning it against
    // all ~4200 positions is what keeps sound and dataset (and picture) from
    // ever drifting apart.
    let checked = 0
    const datasets = [
      { instrument: "guitar" as const, chords: guitarData.chords },
      { instrument: "ukulele" as const, chords: ukuleleData.chords },
    ]
    for (const { instrument, chords } of datasets) {
      for (const [root, entries] of Object.entries(chords)) {
        for (const entry of entries) {
          entry.positions.forEach((position, index) => {
            const shape: GuitarShape = {
              frets: position.frets,
              fingers: [],
              barres: [],
              baseFret: position.baseFret,
            }
            expect(
              frettedSoundingMidis(shape, instrument, 0),
              `${instrument} ${root}${entry.suffix} position ${index}`
            ).toEqual(position.midi)
            checked += 1
          })
        }
      }
    }
    expect(checked).toBeGreaterThan(4100)
  })

  it("sounds the ukulele's reentrant G where the diagram shows it", () => {
    const [shape] = findUkuleleShapes("C")
    expect(shape).toBeDefined()
    if (!shape) return
    // G4 C4 E4 C5: the reentrant G sits above the C, exactly as drawn.
    expect(frettedSoundingMidis(shape, "ukulele", 0)).toEqual([67, 60, 64, 72])
  })

  it("sounds a derived bass position from its open strings", () => {
    const shape = findBassChord("C")
    expect(shape).not.toBeNull()
    if (!shape) return
    // G1 (E string, fret 3) under C2 (A string, fret 3), two strings muted.
    expect(bassSoundingMidis(shape, 0)).toEqual([31, 36])
    expect(bassSoundingMidis(shape, 1)).toEqual([32, 37])
  })

  it("stacks a piano voicing close-position above the bass floor", () => {
    const c = findPianoChord("C")
    if (c) expect(pianoSoundingMidis(c)).toEqual([48, 52, 55])
    // Slash chord: the bass note anchors an octave down, the chord still
    // stacks from C3 upward.
    const over = findPianoChord("G/B")
    if (over) expect(pianoSoundingMidis(over)).toEqual([47, 55, 59, 62])
    const e7 = findPianoChord("E7")
    if (e7) expect(pianoSoundingMidis(e7)).toEqual([52, 56, 59, 62])
  })

  it("keeps every piano voicing ordered and above C2", () => {
    for (const name of ["C", "G/B", "E7", "Am7", "F#m7b5", "Bb", "Dm/F", "B7"]) {
      const shape = findPianoChord(name)
      expect(shape, name).not.toBeNull()
      if (!shape) continue
      const midis = pianoSoundingMidis(shape)
      expect(midis, name).toHaveLength(
        shape.pitchClasses.length + (shape.bassIndex !== null ? 1 : 0)
      )
      expect(midis[0], name).toBeGreaterThanOrEqual(36)
      for (let i = 1; i < midis.length; i += 1) {
        expect(midis[i], `${name} note ${i}`).toBeGreaterThan(midis[i - 1])
      }
    }
  })
})
