import { describe, expect, it } from "vitest"

import type { SongSection } from "@/interfaces/song"
import {
  parseChordLine,
  parseChordPro,
  serializeChordLine,
  serializeChordPro,
  type ChordProDocument,
} from "@/libs/chordpro"
import { createSection, emptyLine, normalizeSectionLabels } from "@/libs/songUtils"

const sectionsOf = (sections: SongSection[]): SongSection[] => normalizeSectionLabels(sections)

/** Drops the generated ids so a parsed tree can be compared to the original. */
const shape = (sections: SongSection[]) =>
  sections.map((section) => ({
    type: section.type,
    label: section.label,
    // Chord-only lines may gain padding spaces on the round trip; only the
    // chord positions matter for them.
    lines: section.lines.map((line) => ({ text: line.text.replace(/\s+$/, ""), chords: line.chords })),
  }))

describe("parseChordLine", () => {
  it("lifts inline chords into positions on the lyric text", () => {
    expect(parseChordLine("[C]Hello [G]world")).toEqual({
      text: "Hello world",
      chords: [
        { chord: "C", position: 0 },
        { chord: "G", position: 6 },
      ],
    })
  })

  it("keeps mid-word positions", () => {
    expect(parseChordLine("Hel[Am]lo")).toEqual({
      text: "Hello",
      chords: [{ chord: "Am", position: 3 }],
    })
  })

  it("ignores empty markers", () => {
    expect(parseChordLine("Hi []there")).toEqual({ text: "Hi there", chords: [] })
  })

  it("leaves a plain line alone", () => {
    expect(parseChordLine("Just words")).toEqual({ text: "Just words", chords: [] })
  })
})

describe("serializeChordLine", () => {
  it("round-trips the chord grid", () => {
    const line = { text: "Hello world", chords: [{ chord: "C", position: 0 }, { chord: "G", position: 6 }] }
    expect(serializeChordLine(line)).toBe("[C]Hello [G]world")
    expect(parseChordLine(serializeChordLine(line))).toEqual(line)
  })

  it("pads a chord placed past the end of the line so its position survives", () => {
    expect(serializeChordLine({ text: "Hi", chords: [{ chord: "C", position: 4 }] })).toBe("Hi  [C]")
    expect(parseChordLine("Hi  [C]")).toEqual({ text: "Hi  ", chords: [{ chord: "C", position: 4 }] })
  })
})

describe("parseChordPro", () => {
  it("reads the metadata directives", () => {
    const doc = parseChordPro(
      ["{title: Wonderwall}", "{artist: Oasis}", "{key: F#m}", "{capo: 2}", "Verse", "Today"].join("\n"),
    )
    expect(doc.title).toBe("Wonderwall")
    expect(doc.artist).toBe("Oasis")
    expect(doc.key).toBe("F#m")
    expect(doc.capo).toBe(2)
  })

  it("splits start/end sections and numbers them", () => {
    const doc = parseChordPro(
      [
        "{start_of_verse}",
        "Today is gonna be the day",
        "{end_of_verse}",
        "{start_of_chorus}",
        "Because maybe",
        "{end_of_chorus}",
      ].join("\n"),
    )
    expect(doc.sections.map((section) => section.type)).toEqual(["verse", "chorus"])
    expect(doc.sections.map((section) => section.label)).toEqual(["Verse 1", "Chorus 1"])
  })

  it("wraps loose lines in an implicit verse", () => {
    const doc = parseChordPro("Just a line")
    expect(doc.sections).toHaveLength(1)
    expect(doc.sections[0]?.type).toBe("verse")
    expect(doc.sections[0]?.lines[0]?.text).toBe("Just a line")
  })

  it("keeps a custom section's label", () => {
    const doc = parseChordPro("{start_of_section: Sax solo}\nla la\n{end_of_section}")
    expect(doc.sections[0]?.type).toBe("custom")
    expect(doc.sections[0]?.label).toBe("Sax solo")
  })

  it("turns a comment into a plain line and ignores unknown directives", () => {
    const doc = parseChordPro(["{comment: Quiet}", "{define: C base-fret 1}", "Sing"].join("\n"))
    expect(doc.sections[0]?.lines.map((line) => line.text)).toEqual(["Quiet", "Sing"])
  })

  it("returns a single empty verse for an empty document", () => {
    const doc = parseChordPro("")
    expect(doc.sections).toHaveLength(1)
    expect(doc.sections[0]?.lines).toHaveLength(1)
  })
})

describe("ChordPro round-trip", () => {
  const document = (): ChordProDocument => ({
    title: "Wonderwall",
    artist: "Oasis",
    key: "F#m",
    capo: 2,
    sections: sectionsOf([
      createSection("verse", "", [
        { text: "Today is gonna be the day", chords: [{ chord: "Em7", position: 0 }, { chord: "G", position: 12 }] },
        emptyLine(""),
        { text: "That they're gonna throw it back to you", chords: [] },
      ]),
      createSection("chorus", "", [
        { text: "Because maybe", chords: [{ chord: "C", position: 0 }, { chord: "D", position: 8 }] },
      ]),
      createSection("custom", "Sax solo", [{ text: "", chords: [{ chord: "Em", position: 0 }, { chord: "G", position: 1 }] }]),
    ]),
  })

  it("reproduces metadata, sections and chords", () => {
    const original = document()
    const reparsed = parseChordPro(serializeChordPro(original))
    expect(reparsed.title).toBe(original.title)
    expect(reparsed.artist).toBe(original.artist)
    expect(reparsed.key).toBe(original.key)
    expect(reparsed.capo).toBe(original.capo)
    expect(shape(reparsed.sections)).toEqual(shape(original.sections))
  })

  it("survives a second round-trip unchanged", () => {
    const once = serializeChordPro(parseChordPro(serializeChordPro(document())))
    const twice = serializeChordPro(parseChordPro(once))
    expect(twice).toBe(once)
  })

  it("omits empty metadata directives", () => {
    const text = serializeChordPro({ title: "", artist: "X", key: "", capo: 0, sections: [] })
    expect(text).toBe("{artist: X}\n")
  })
})
