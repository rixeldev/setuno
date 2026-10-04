import { describe, expect, it } from "vitest"

import type { SongSection } from "@/interfaces/song"
import {
  cloneSections,
  countSongChords,
  countSongLines,
  createSection,
  detectSectionHeader,
  emptyLine,
  estimateDurationSec,
  insertLineAfter,
  moveChord,
  normalizeChords,
  normalizeSectionLabels,
  parseLyricBlock,
  sectionLabel,
  setChordAt,
  songLyricsText,
  transposeSections,
} from "@/libs/songUtils"

const verse = (): SongSection => ({
  id: "sec_verse",
  type: "verse",
  label: "Verse 1",
  lines: [
    { text: "Hello world", chords: [{ chord: "C", position: 0 }, { chord: "G", position: 6 }] },
    { text: "Good night", chords: [{ chord: "Am", position: 0 }] },
  ],
})

describe("section labels", () => {
  it("numbers repeated sections but not one-offs", () => {
    expect(sectionLabel("verse", 1)).toBe("Verse 1")
    expect(sectionLabel("chorus", 3)).toBe("Chorus 3")
    expect(sectionLabel("intro", 1)).toBe("Intro")
    expect(sectionLabel("instrumental", 2)).toBe("Instrumental")
  })

  it("renumbers after a section is added or removed", () => {
    const sections: SongSection[] = [
      { id: "a", type: "verse", label: "anything", lines: [emptyLine("a")] },
      { id: "b", type: "chorus", label: "anything", lines: [emptyLine("b")] },
      { id: "c", type: "verse", label: "anything", lines: [emptyLine("c")] },
    ]
    expect(normalizeSectionLabels(sections).map((section) => section.label)).toEqual([
      "Verse 1",
      "Chorus 1",
      "Verse 2",
    ])
  })

  it("leaves a custom label alone", () => {
    const sections: SongSection[] = [
      { id: "a", type: "custom", label: "Middle eight", lines: [emptyLine("a")] },
    ]
    expect(normalizeSectionLabels(sections)[0]?.label).toBe("Middle eight")
  })
})

describe("section header detection", () => {
  it("recognises the usual headers", () => {
    expect(detectSectionHeader("Chorus")).toMatchObject({ type: "chorus" })
    expect(detectSectionHeader("[Verse 2]")).toMatchObject({ type: "verse" })
    expect(detectSectionHeader("BRIDGE:")).toMatchObject({ type: "bridge" })
    expect(detectSectionHeader("Pre-Chorus")).toMatchObject({ type: "pre-chorus" })
    expect(detectSectionHeader("Interlude")).toMatchObject({ type: "instrumental" })
  })

  it("does not mistake lyric lines for headers", () => {
    expect(detectSectionHeader("I got a feeling in my body")).toBeNull()
    expect(detectSectionHeader("")).toBeNull()
  })
})

describe("parseLyricBlock", () => {
  it("splits a pasted lyric block into numbered sections", () => {
    const sections = parseLyricBlock(
      ["Verse 1", "Hello world", "Good night", "", "Chorus", "Hello world"].join("\n"),
    )
    expect(sections.map((section) => section.label)).toEqual(["Verse 1", "Chorus 1"])
    expect(sections[0]?.lines.map((line) => line.text)).toEqual(["Hello world", "Good night", ""])
  })

  it("starts an implicit verse when there is no header", () => {
    const sections = parseLyricBlock("Hello world")
    expect(sections).toHaveLength(1)
    expect(sections[0]?.type).toBe("verse")
  })

  it("drops a header that was never followed by a lyric line", () => {
    const sections = parseLyricBlock("Intro\n\nChorus\nReal words")
    expect(sections.map((section) => section.label)).toEqual(["Chorus 1"])
  })

  it("normalises Windows line endings", () => {
    const sections = parseLyricBlock("Verse 1\r\nHello")
    expect(sections[0]?.lines).toHaveLength(1)
  })
})

describe("normalizeChords", () => {
  it("trims, clamps and sorts", () => {
    const chords = normalizeChords(
      [
        { chord: "  G  ", position: 6 },
        { chord: "C", position: 0 },
        { chord: "", position: 2 },
        { chord: "F", position: 999 },
      ],
      11,
    )
    expect(chords).toEqual([
      { chord: "C", position: 0 },
      { chord: "G", position: 6 },
      { chord: "F", position: 11 },
    ])
  })

  it("keeps the first chord when two land on the same position", () => {
    const chords = normalizeChords(
      [
        { chord: "C", position: 4 },
        { chord: "D", position: 4 },
      ],
      10,
    )
    expect(chords).toEqual([{ chord: "C", position: 4 }])
  })

  it("rounds fractional positions and never goes negative", () => {
    expect(normalizeChords([{ chord: "C", position: 2.6 }], 10)).toEqual([{ chord: "C", position: 3 }])
    expect(normalizeChords([{ chord: "C", position: -5 }], 10)).toEqual([{ chord: "C", position: 0 }])
  })
})

describe("chord editing", () => {
  it("moves a chord to a new position", () => {
    const chords = moveChord(verse().lines[0]?.chords ?? [], 6, 2, "Hello world".length)
    expect(chords).toEqual([
      { chord: "C", position: 0 },
      { chord: "G", position: 2 },
    ])
  })

  it("replaces the chord already anchored at a position", () => {
    const chords = setChordAt(verse().lines[0]?.chords ?? [], 6, "D", "Hello world".length)
    expect(chords).toEqual([
      { chord: "C", position: 0 },
      { chord: "D", position: 6 },
    ])
  })

  it("removes a chord when the new value is empty", () => {
    const chords = setChordAt(verse().lines[0]?.chords ?? [], 6, "   ", "Hello world".length)
    expect(chords).toEqual([{ chord: "C", position: 0 }])
  })

  it("adds a chord at a free position", () => {
    const chords = setChordAt(verse().lines[0]?.chords ?? [], 4, "Am", "Hello world".length)
    expect(chords).toEqual([
      { chord: "C", position: 0 },
      { chord: "Am", position: 4 },
      { chord: "G", position: 6 },
    ])
  })

  it("clamps a chord dragged past the end of the line", () => {
    const chords = setChordAt([], 99, "C", 11)
    expect(chords).toEqual([{ chord: "C", position: 11 }])
  })
})

describe("transposeSections", () => {
  it("transposes every chord and leaves the lyrics alone", () => {
    const transposed = transposeSections([verse()], 2)
    expect(transposed[0]?.lines[0]).toEqual({
      text: "Hello world",
      chords: [
        { chord: "D", position: 0 },
        { chord: "A", position: 6 },
      ],
    })
  })

  it("returns the very same array when nothing moves", () => {
    const sections = [verse()]
    expect(transposeSections(sections, 0)).toBe(sections)
  })

  it("never mutates the source song", () => {
    const sections = [verse()]
    transposeSections(sections, 5)
    expect(sections[0]?.lines[0]?.chords[0]?.chord).toBe("C")
  })
})

describe("song statistics", () => {
  it("counts lines and chords", () => {
    expect(countSongLines([verse()])).toBe(2)
    expect(countSongChords([verse()])).toBe(3)
  })

  it("estimates a duration from the word count", () => {
    // 4 words at ~2.4 words per second.
    expect(estimateDurationSec([verse()])).toBe(2)
    expect(estimateDurationSec([])).toBe(0)
  })

  it("renders a plain-text copy for the clipboard", () => {
    expect(songLyricsText([verse()])).toBe("[Verse 1]\nHello world\nGood night")
  })

  it("deep-clones so the editor cannot write through to the cache", () => {
    const sections = [verse()]
    const copy = cloneSections(sections)
    const firstChord = copy[0]?.lines[0]?.chords[0]
    if (firstChord) firstChord.chord = "Bb"
    expect(sections[0]?.lines[0]?.chords[0]?.chord).toBe("C")
  })
})

describe("insertLineAfter", () => {
  it("inserts a blank line after the given index", () => {
    const lines = [emptyLine("a"), emptyLine("b")]
    expect(insertLineAfter(lines, 0).map((line) => line.text)).toEqual(["a", "", "b"])
  })

  it("appends when the index is the last line", () => {
    const lines = [emptyLine("a")]
    expect(insertLineAfter(lines, 0).map((line) => line.text)).toEqual(["a", ""])
  })

  it("does not mutate the input", () => {
    const lines = [emptyLine("a")]
    insertLineAfter(lines, 0)
    expect(lines).toHaveLength(1)
  })
})

describe("createSection", () => {
  it("gives every section its own id", () => {
    const first = createSection("verse", "Verse 1", [emptyLine("x")])
    const second = createSection("verse", "Verse 2", [emptyLine("y")])
    expect(first.id).not.toBe(second.id)
  })
})