import { describe, expect, it } from "vitest"

import {
  MONO_ADVANCE_RATIO,
  charactersPerRow,
  monoAdvance,
  splitLyricRows,
} from "@/libs/lyricRows"

describe("charactersPerRow", () => {
  it("counts the characters that fit in a width", () => {
    // 10px per character, 100px of room: nine characters fit with room to spare.
    expect(charactersPerRow(100, 10)).toBe(9)
  })

  it("answers nothing when the width or the advance is unknown", () => {
    expect(charactersPerRow(0, 10)).toBe(0)
    expect(charactersPerRow(100, 0)).toBe(0)
    expect(charactersPerRow(-5, 10)).toBe(0)
  })
})

describe("monoAdvance", () => {
  it("uses the bundled face's own advance", () => {
    expect(monoAdvance(20)).toBe(20 * MONO_ADVANCE_RATIO)
  })

  it("prefers the measured ratio when there is one", () => {
    expect(monoAdvance(20, 0.5)).toBe(10)
  })

  it("falls back to the bundled ratio when the measurement is nonsense", () => {
    expect(monoAdvance(20, 0)).toBe(20 * MONO_ADVANCE_RATIO)
  })
})

describe("splitLyricRows", () => {
  const line = "Es difícil entender como viviste Tú por mí"

  it("keeps a line that fits on one row", () => {
    const rows = splitLyricRows(line, [{ chord: "Fm", position: 0 }], 60)
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe(line)
    expect(rows[0].chords).toEqual([{ chord: "Fm", label: "Fm", offset: 0 }])
  })

  it("cuts a line that does not fit at a word boundary", () => {
    const rows = splitLyricRows(line, [], 20)
    expect(rows.map((row) => row.text)).toEqual(["Es difícil entender", "como viviste Tú por", "mí"])
  })

  it("keeps every chord over the word it belongs to", () => {
    const rows = splitLyricRows(
      line,
      [
        { chord: "Fm", position: 0 },
        { chord: "D#/G", position: 11 },
        { chord: "G#", position: 36 },
      ],
      20,
    )
    expect(rows.map((row) => row.text)).toEqual(["Es difícil entender", "como viviste Tú por", "mí"])
    // The first chord is on the first row, the second on the first row too
    // ("entender"), and the third on the second row ("por").
    expect(rows[0].chords.map((chord) => chord.chord)).toEqual(["Fm", "D#/G"])
    expect(rows[0].chords.map((chord) => chord.offset)).toEqual([0, 11])
    expect(rows[1].chords.map((chord) => chord.chord)).toEqual(["G#"])
    expect(rows[1].chords.map((chord) => chord.offset)).toEqual([16])
  })

  it("moves the cut earlier when a chord would not fit in the row", () => {
    // A five-character chord over "entender" would end past the row, so the
    // row ends before that word.
    const rows = splitLyricRows(line, [{ chord: "Cmaj7", position: 16 }], 20)
    expect(rows.map((row) => row.text)).toEqual(["Es difícil", "entender como", "viviste Tú por mí"])
    expect(rows[0].chords).toEqual([])
    expect(rows[1].chords).toEqual([{ chord: "Cmaj7", label: "Cmaj7", offset: 5 }])
  })

  it("draws the line as one row when the room is unknown", () => {
    const rows = splitLyricRows(line, [{ chord: "Fm", position: 0 }], 0)
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe(line)
    expect(rows[0].chords).toEqual([{ chord: "Fm", label: "Fm", offset: 0 }])
  })

  it("spells a chord with the label it is drawn with", () => {
    const rows = splitLyricRows(line, [{ chord: "C", label: "Do", position: 0 }], 60)
    expect(rows[0].chords).toEqual([{ chord: "C", label: "Do", offset: 0 }])
  })

  it("ignores an empty chord", () => {
    const rows = splitLyricRows(line, [{ chord: "  ", position: 0 }], 60)
    expect(rows[0].chords).toEqual([])
  })

  it("keeps a chord that fell between two words", () => {
    // The chord sits on the space between "Es" and "difícil".
    const rows = splitLyricRows(line, [{ chord: "A#", position: 2 }], 20)
    expect(rows.flatMap((row) => row.chords.map((chord) => chord.chord))).toEqual(["A#"])
  })

  it("answers one empty row for a line without words", () => {
    const rows = splitLyricRows("   ", [], 20)
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe("   ")
  })
})
