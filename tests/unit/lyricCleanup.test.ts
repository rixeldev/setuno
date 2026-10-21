import { describe, expect, it } from "vitest"

import { cleanLyricText, chordTokens, tidyHeader } from "@/libs/lyricCleanup"
import { parseLyricBlock } from "@/libs/songUtils"

describe("cleanLyricText", () => {
  it("merges a chord line into the lyric under it", () => {
    const result = cleanLyricText(["C", "Hold on"].join("\n"))

    expect(result.text).toBe("[C]Hold on")
    expect(result.counts["merged-chords"]).toBe(1)
  })

  it("puts each chord over the word under it", () => {
    const result = cleanLyricText(["C     G", "Hello world"].join("\n"))

    // The "G" sits on the sixth character, which is where "world" starts.
    expect(result.text).toBe("[C]Hello [G]world")
  })

  it("tidies a header so the importer recognises it", () => {
    expect(tidyHeader("— Chorus —")).toBe("Chorus")
    expect(tidyHeader("[Verse 2]")).toBe("Verse 2")
    expect(tidyHeader("1. VERSE")).toBe("Verse")
    expect(tidyHeader("Chorus (x2)")).toBe("Chorus")
  })

  it("drops the lines that are not lyrics", () => {
    const result = cleanLyricText(
      ["Key: G", "Tuning: Standard", "120 bpm", "Capo 2", "One two three"].join("\n"),
    )

    expect(result.text).toBe("One two three")
    expect(result.counts["dropped-noise"]).toBe(4)
  })

  it("keeps a chord line that has no lyric under it", () => {
    const result = cleanLyricText(["C G", "", "One two"].join("\n"))

    expect(result.text).toBe("C G\n\nOne two")
    expect(result.counts["merged-chords"]).toBeUndefined()
  })

  it("does not mistake a lyric for a chord line", () => {
    const result = cleanLyricText(["I am here", "And you know"].join("\n"))

    expect(result.text).toBe("I am here\nAnd you know")
    expect(result.counts["merged-chords"]).toBeUndefined()
  })

  it("gives the editor a text the paste importer understands", () => {
    const cleaned = cleanLyricText(
      ["— Chorus —", "C     G", "Hello world", "", "— Verse —", "One two"].join("\n"),
    )

    const sections = parseLyricBlock(cleaned.text)
    expect(sections).toHaveLength(2)
    expect(sections[0]?.type).toBe("chorus")
    expect(sections[0]?.lines[0]?.chords[0]?.chord).toBe("C")
    expect(sections[0]?.lines[0]?.chords[0]?.position).toBe(0)
    expect(sections[0]?.lines[0]?.text).toBe("Hello world")
  })

  it("leaves a clean text alone", () => {
    const source = ["Verse 1", "", "One two", "Three four"].join("\n")
    const result = cleanLyricText(source)

    expect(result.text).toBe(source)
    expect(Object.keys(result.counts)).toHaveLength(0)
  })
})

describe("chordTokens", () => {
  it("reads the chords and the column each one sits in", () => {
    expect(chordTokens("C   G")).toEqual([
      { chord: "C", column: 0 },
      { chord: "G", column: 4 },
    ])
  })

  it("ignores the bar lines", () => {
    expect(chordTokens("| C | G |")).toEqual([
      { chord: "C", column: 2 },
      { chord: "G", column: 6 },
    ])
  })

  it("says no when the line is a lyric", () => {
    expect(chordTokens("I am here")).toBeNull()
  })
})
