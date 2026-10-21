import { describe, expect, it } from "vitest"

import type { OcrLine, OcrResult } from "@/interfaces/ocr"
import { proposeSongFromOcr } from "@/libs/ocrSheet"
import { parseLyricBlock } from "@/libs/songUtils"

/** The width of one character in the fake sheets below. */
const CHAR = 10

/** One word placed at an exact spot. */
const word = (text: string, x: number, top: number, height = 20) => ({
  text,
  box: { x, y: top, width: text.length * CHAR, height },
})

/** A row of words, laid out one after the other. */
const row = (words: { text: string; x: number }[], top: number, height = 20): OcrLine => {
  const built = words.map((entry) => word(entry.text, entry.x, top, height))
  return {
    text: built.map((entry) => entry.text).join(" "),
    box: { x: 0, y: top, width: 1000, height },
    words: built,
  }
}

/** A sheet made of the given rows. */
const sheet = (lines: OcrLine[], pageWidth = 1000, pageHeight = 2000): OcrResult => ({
  pages: [{ width: pageWidth, height: pageHeight, lines }],
})

describe("proposeSongFromOcr", () => {
  it("puts a chord row over the words it belongs to", () => {
    // The chords sit right above the word they change.
    const result = sheet([
      row([{ text: "C", x: 0 }, { text: "G", x: 60 }], 0),
      row([{ text: "Hello", x: 0 }, { text: "world", x: 60 }], 30),
    ])

    const proposal = proposeSongFromOcr(result)

    expect(proposal.text).toBe("[C]Hello [G]world")
  })

  it("reads a section header and keeps it for the parser", () => {
    const result = sheet([
      row([{ text: "Chorus", x: 0 }], 0),
      row([{ text: "Hold", x: 0 }], 30),
    ])

    const proposal = proposeSongFromOcr(result)

    expect(proposal.text).toContain("Chorus")
    const sections = parseLyricBlock(proposal.text)
    expect(sections).toHaveLength(1)
    expect(sections[0]?.type).toBe("chorus")
    expect(sections[0]?.lines[0]?.text).toBe("Hold")
  })

  it("reads the key and the tempo and drops the metadata rows", () => {
    const result = sheet([
      row([{ text: "Key:", x: 0 }, { text: "Am", x: 60 }], 0),
      row([{ text: "120", x: 0 }, { text: "bpm", x: 40 }], 30),
      row([{ text: "Capo", x: 0 }, { text: "2", x: 60 }], 60),
      row([{ text: "A", x: 0 }], 100),
      row([{ text: "light", x: 0 }], 130),
      row([{ text: "in", x: 0 }, { text: "here", x: 40 }], 160),
    ])

    const proposal = proposeSongFromOcr(result)

    expect(proposal.key).toBe("Am")
    expect(proposal.bpm).toBe(120)
    expect(proposal.capo).toBe(2)
    expect(proposal.text).not.toContain("bpm")
    expect(proposal.text).not.toContain("Capo")
  })

  it("keeps the chords of a row that also carries bar lines", () => {
    const result = sheet([
      row([{ text: "|", x: 0 }, { text: "C", x: 30 }, { text: "|", x: 60 }, { text: "G", x: 90 }], 0),
      row([{ text: "Sing", x: 0 }, { text: "it", x: 60 }], 30),
    ])

    const proposal = proposeSongFromOcr(result)

    expect(proposal.text).toContain("[C]")
    expect(proposal.text).toContain("[G]")
  })

  it("takes the title from the tallest line", () => {
    const result = sheet([
      row([{ text: "Wonderwall", x: 0 }], 0, 40),
      row([{ text: "Oasis", x: 0 }], 50, 24),
      row([{ text: "Today", x: 0 }], 90, 20),
    ])

    const proposal = proposeSongFromOcr(result)

    expect(proposal.title).toBe("Wonderwall")
    // The title is not a lyric line.
    expect(proposal.text).not.toContain("Wonderwall")
  })

  it("leaves an intro progression on its own line", () => {
    const result = sheet([
      row([{ text: "C", x: 0 }, { text: "G", x: 60 }], 0),
      row([{ text: "Verse", x: 0 }], 40),
      row([{ text: "One", x: 0 }], 70),
    ])

    const proposal = proposeSongFromOcr(result)

    expect(proposal.text.split("\n")[0]).toBe("[C]      [G]")
  })

  it("says what is missing instead of pretending", () => {
    const empty = proposeSongFromOcr(sheet([row([{ text: "Chorus", x: 0 }], 0)]))
    expect(empty.warnings).toContain("no-lyrics")
    expect(empty.warnings).toContain("no-chords")

    const lyricsOnly = proposeSongFromOcr(
      sheet([
        row([{ text: "One", x: 0 }], 0),
        row([{ text: "two", x: 0 }], 30),
        row([{ text: "three", x: 0 }], 60),
      ]),
    )
    expect(lyricsOnly.warnings).toContain("no-chords")
    expect(lyricsOnly.warnings).not.toContain("no-lyrics")
  })

  it("trusts the recognizer's own confidence", () => {
    const lines = [
      row([{ text: "One", x: 0 }], 0),
      row([{ text: "two", x: 0 }], 30),
      row([{ text: "three", x: 0 }], 60),
    ].map((line) => ({ ...line, confidence: 0.2 }))

    const proposal = proposeSongFromOcr(sheet(lines))

    expect(proposal.confidence).toBeLessThan(0.6)
    expect(proposal.warnings).toContain("unsure")
  })

  it("separates stanzas when the sheet leaves a gap", () => {
    const result = sheet([
      row([{ text: "One", x: 0 }], 0),
      row([{ text: "two", x: 0 }], 30),
      row([{ text: "three", x: 0 }], 120),
    ])

    const proposal = proposeSongFromOcr(result)

    expect(proposal.text).toBe("One\ntwo\n\nthree")
  })
})
