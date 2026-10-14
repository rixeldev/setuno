import { describe, expect, it } from "vitest"

import type { SongSection } from "@/interfaces/song"
import {
  MAX_SECTION_BARS,
  balanceColumns,
  buildChordRow,
  buildChordSegments,
  chordAnchors,
  chordPositionLimit,
  clampSectionBars,
  cloneSections,
  countSongChords,
  countSongLines,
  createSection,
  detectSectionHeader,
  duplicateSection,
  emptyLine,
  estimateDurationSec,
  insertLineAfter,
  isNumberedSection,
  moveChord,
  normalizeChords,
  normalizeSectionLabels,
  parseLyricBlock,
  reanchorChords,
  resolveSectionLabel,
  sectionLabel,
  sectionLabelFor,
  sectionOrdinal,
  setChordAt,
  shiftChordByCharacter,
  shiftChordToAnchor,
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

  it("turns inline [Chord] markers into the chord grid", () => {
    const sections = parseLyricBlock("Verse 1\n[Am]Hello [G]world")
    expect(sections[0]?.lines[0]).toEqual({
      text: "Hello world",
      chords: [
        { chord: "Am", position: 0 },
        { chord: "G", position: 6 },
      ],
    })
  })

  it("strips other apps' metadata headers and repeat markers", () => {
    const sections = parseLyricBlock(
      ["Capo: 2", "Tuning: Standard", "132 bpm", "x2", "https://example.com", "Hello world"].join("\n"),
    )
    expect(sections).toHaveLength(1)
    expect(sections[0]?.lines.map((line) => line.text)).toEqual(["Hello world"])
  })

  it("collapses runs of blank lines into one stanza break", () => {
    const sections = parseLyricBlock("Verse 1\nHello\n\n\n\nGoodbye")
    expect(sections[0]?.lines.map((line) => line.text)).toEqual(["Hello", "", "Goodbye"])
  })

  it("keeps a chord-only progression section", () => {
    const sections = parseLyricBlock("Intro\n[Am] [G] [F]")
    expect(sections[0]?.type).toBe("intro")
    expect(sections[0]?.lines[0]?.chords.map((chord) => chord.chord)).toEqual(["Am", "G", "F"])
  })

  it("replaces non-breaking spaces with normal ones", () => {
    const sections = parseLyricBlock("Hello\u00A0world")
    expect(sections[0]?.lines[0]?.text).toBe("Hello world")
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

describe("chord-only lines", () => {
  it("only clamps chords to the lyric text when there are words", () => {
    expect(chordPositionLimit("Hello world")).toBe(11)
    expect(chordPositionLimit("")).toBe(Number.MAX_SAFE_INTEGER)
    expect(chordPositionLimit("   ")).toBe(Number.MAX_SAFE_INTEGER)
  })

  it("grows a progression without typing lyrics", () => {
    const limit = chordPositionLimit("")
    let chords = setChordAt([], 0, "C", limit)
    chords = setChordAt(chords, 1, "G", limit)
    chords = setChordAt(chords, 2, "Am", limit)
    chords = setChordAt(chords, 3, "F", limit)
    expect(chords).toEqual([
      { chord: "C", position: 0 },
      { chord: "G", position: 1 },
      { chord: "Am", position: 2 },
      { chord: "F", position: 3 },
    ])

    // Removing the middle chord keeps the rest of the progression.
    const trimmed = setChordAt(chords, 2, "", limit)
    expect(trimmed).toEqual([
      { chord: "C", position: 0 },
      { chord: "G", position: 1 },
      { chord: "F", position: 3 },
    ])
  })
})

describe("moving chords between anchors (progressions)", () => {
  const slots = [0, 1, 2]

  it("swaps with the chord already sitting on the target", () => {
    const chords = [
      { chord: "C", position: 0 },
      { chord: "G", position: 1 },
      { chord: "Am", position: 2 },
    ]
    expect(shiftChordToAnchor(chords, 0, slots, 1, Number.MAX_SAFE_INTEGER)).toEqual([
      { chord: "G", position: 0 },
      { chord: "C", position: 1 },
      { chord: "Am", position: 2 },
    ])
  })

  it("returns the very same array at the boundaries", () => {
    const atStart = [{ chord: "C", position: 0 }]
    expect(shiftChordToAnchor(atStart, 0, slots, -1, Number.MAX_SAFE_INTEGER)).toBe(atStart)
    const atEnd = [{ chord: "C", position: 2 }]
    expect(shiftChordToAnchor(atEnd, 2, slots, 1, Number.MAX_SAFE_INTEGER)).toBe(atEnd)
  })
})

describe("precise chord placement", () => {
  it("lists word starts and the end of the line as anchors", () => {
    expect(chordAnchors("Hello world")).toEqual([0, 6, 11])
    expect(chordAnchors("")).toEqual([0])
  })

  it("nudges a chord one character at a time, even inside a word", () => {
    const chords = [{ chord: "C", position: 3 }]
    expect(shiftChordByCharacter(chords, 3, 1, 11)).toEqual([{ chord: "C", position: 4 }])
    expect(shiftChordByCharacter(chords, 3, -1, 11)).toEqual([{ chord: "C", position: 2 }])
  })

  it("skips the position taken by another chord", () => {
    const chords = [
      { chord: "Am", position: 2 },
      { chord: "C", position: 3 },
    ]
    expect(shiftChordByCharacter(chords, 2, 1, 11)).toEqual([
      { chord: "C", position: 3 },
      { chord: "Am", position: 4 },
    ])
  })

  it("stops at the line boundaries", () => {
    const atStart = [{ chord: "C", position: 0 }]
    expect(shiftChordByCharacter(atStart, 0, -1, 11)).toBe(atStart)
    const atEnd = [{ chord: "C", position: 11 }]
    expect(shiftChordByCharacter(atEnd, 11, 1, 11)).toBe(atEnd)
  })
})

describe("buildChordRow", () => {
  it("pads every chord to its exact character column", () => {
    const row = buildChordRow(
      [
        { chord: "C", position: 0 },
        { chord: "G", position: 6 },
      ],
      "Hello world",
    )
    expect(row.indexOf("C")).toBe(0)
    expect(row.indexOf("G")).toBe(6)
  })

  it("aligns a chord placed in the middle of a word", () => {
    const row = buildChordRow([{ chord: "Am", position: 3 }], "Hello world")
    expect(row.indexOf("Am")).toBe(3)
  })

  it("shifts a chord that would overwrite the previous one", () => {
    const row = buildChordRow(
      [
        { chord: "Am", position: 0 },
        { chord: "G", position: 1 },
      ],
      "Hi",
    )
    expect(row.indexOf("Am")).toBe(0)
    expect(row.indexOf("G")).toBe(3)
  })

  it("clamps positions to the end of the line", () => {
    expect(buildChordRow([{ chord: "C", position: 99 }], "Hi").indexOf("C")).toBe(2)
  })

  it("returns an empty row without chords", () => {
    expect(buildChordRow([], "Hi")).toBe("")
  })
})

describe("buildChordSegments", () => {
  it("joins back into the exact buildChordRow text", () => {
    const entries = [
      { chord: "C", position: 0 },
      { chord: "G", position: 6 },
    ]
    expect(buildChordSegments(entries, "Hello world").map((segment) => segment.text).join("")).toBe(
      buildChordRow(entries, "Hello world"),
    )
  })

  it("tags chord segments with the letter spelling and keeps the display label", () => {
    const segments = buildChordSegments(
      [{ chord: "F#m7", position: 3, label: "Fa#m7" }],
      "Hello world",
    )
    expect(segments).toEqual([{ text: "   " }, { text: "Fa#m7", chord: "F#m7" }, { text: " " }])
  })
})

describe("reanchorChords", () => {
  it("keeps the chord on its character when text is inserted before it", () => {
    expect(reanchorChords([{ chord: "C", position: 6 }], "Hello world", "Hello big world")).toEqual([
      { chord: "C", position: 10 },
    ])
  })

  it("follows the character when text before it is deleted", () => {
    expect(reanchorChords([{ chord: "C", position: 6 }], "Hello world", "world")).toEqual([
      { chord: "C", position: 0 },
    ])
  })

  it("keeps mid-word positions instead of snapping to the word", () => {
    expect(reanchorChords([{ chord: "C", position: 3 }], "Hello", "Hello!")).toEqual([
      { chord: "C", position: 3 },
    ])
  })

  it("collapses a chord inside the replaced range to the edit point", () => {
    expect(reanchorChords([{ chord: "C", position: 3 }], "abXYZc", "abc")).toEqual([
      { chord: "C", position: 2 },
    ])
  })

  it("returns the same array when nothing changed", () => {
    const chords = [{ chord: "C", position: 3 }]
    expect(reanchorChords(chords, "Hello", "Hello")).toBe(chords)
  })
})

describe("section labels", () => {
  const sections = [
    { id: "a", type: "intro" as const, label: "Intro", lines: [] },
    { id: "b", type: "verse" as const, label: "Verse 1", lines: [] },
    { id: "c", type: "chorus" as const, label: "Chorus 1", lines: [] },
    { id: "d", type: "verse" as const, label: "Verse 2", lines: [] },
    { id: "e", type: "instrumental" as const, label: "Instrumental", lines: [] },
    { id: "f", type: "custom" as const, label: "Sax solo", lines: [] },
  ]
  // A minimal stand-in for i18next so the helper stays pure.
  const t = (key: string): string =>
    ({
      "songs.intro": "Intro",
      "songs.verse": "Verse",
      "songs.chorus": "Chorus",
      "songs.instrumental": "Instrumental",
      "songs.custom": "Custom",
      "songs.sectionFallback": "Section",
    })[key] ?? key

  it("counts sections per type", () => {
    expect(sectionOrdinal(sections, 1)).toBe(1)
    expect(sectionOrdinal(sections, 3)).toBe(2)
    expect(sectionOrdinal(sections, 0)).toBe(1)
  })

  it("numbers only the types that repeat", () => {
    expect(isNumberedSection("verse")).toBe(true)
    expect(isNumberedSection("chorus")).toBe(true)
    expect(isNumberedSection("intro")).toBe(false)
    expect(isNumberedSection("instrumental")).toBe(false)
    expect(isNumberedSection("outro")).toBe(false)
  })

  it("renders known types from their type + ordinal, ignoring the stored text", () => {
    expect(sectionLabelFor(sections, 0, t)).toBe("Intro")
    expect(sectionLabelFor(sections, 1, t)).toBe("Verse 1")
    expect(sectionLabelFor(sections, 3, t)).toBe("Verse 2")
    expect(sectionLabelFor(sections, 4, t)).toBe("Instrumental")
  })

  it("keeps the stored text for custom sections", () => {
    expect(sectionLabelFor(sections, 5, t)).toBe("Sax solo")
    expect(resolveSectionLabel({ id: "x", type: "custom", label: "  ", lines: [] }, 1, t)).toBe(
      "Section",
    )
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

  it("keeps an optional bar count and omits it when unset", () => {
    expect(createSection("chorus", "Chorus", [emptyLine()]).bars).toBeUndefined()
    expect(createSection("chorus", "Chorus", [emptyLine()], 8).bars).toBe(8)
    // Zero/negative counts are treated as "no counter".
    expect(createSection("chorus", "Chorus", [emptyLine()], 0).bars).toBeUndefined()
  })
})

describe("clampSectionBars", () => {
  it("rounds and clamps into the supported range", () => {
    expect(clampSectionBars(8.4)).toBe(8)
    expect(clampSectionBars(8.6)).toBe(9)
    expect(clampSectionBars(-4)).toBe(0)
    expect(clampSectionBars(5000)).toBe(MAX_SECTION_BARS)
    expect(clampSectionBars(Number.NaN)).toBe(0)
  })
})

describe("duplicateSection", () => {
  it("copies the lines, chords and bar count under a new id", () => {
    const source = createSection(
      "chorus",
      "Chorus",
      [{ text: "Hello", chords: [{ chord: "C", position: 0 }] }],
      8,
    )
    const copy = duplicateSection(source)
    expect(copy.id).not.toBe(source.id)
    expect(copy.bars).toBe(8)
    expect(copy.label).toBe(source.label)
    expect(copy.lines).toEqual(source.lines)
    // Deep copy: editing the duplicate never touches the original.
    copy.lines[0]!.chords[0]!.chord = "G"
    expect(source.lines[0]?.chords[0]?.chord).toBe("C")
  })
})

describe("balanceColumns", () => {
  const weight = (value: number): number => value

  it("keeps a single column for one column or a single item", () => {
    expect(balanceColumns([1, 2, 3], weight, 1)).toEqual([[1, 2, 3]])
    expect(balanceColumns([1], weight, 2)).toEqual([[1]])
    expect(balanceColumns([], weight, 2)).toEqual([[]])
  })

  it("splits equally weighted items down the middle", () => {
    expect(balanceColumns([1, 1, 1, 1], weight, 2)).toEqual([
      [1, 1],
      [1, 1],
    ])
  })

  it("preserves order and never splits an item", () => {
    const groups = balanceColumns(["a", "b", "c", "d"], () => 1, 2)
    expect(groups.flat()).toEqual(["a", "b", "c", "d"])
  })

  it("balances by weight so the columns end up about the same length", () => {
    // 5 + 1 = 6 on the left, 1 + 1 + 1 = 3 on the right: the heavy first
    // section must not drag the whole song into one column.
    expect(balanceColumns([5, 1, 1, 1], weight, 2)).toEqual([
      [5],
      [1, 1, 1],
    ])
  })

  it("never starts a column it cannot fill", () => {
    // Two items for two columns: the first is heavy but there is nothing left
    // to fill a second column evenly, so the split still happens (1 item each).
    expect(balanceColumns([9, 1], weight, 2)).toEqual([[9], [1]])
    // Fewer items than columns: one column, never an empty one.
    expect(balanceColumns([1, 2], weight, 3)).toEqual([[1, 2]])
  })

  it("treats a weightless item as a spot that still occupies space", () => {
    const sections: SongSection[] = [
      { id: "a", type: "intro", label: "", lines: [] },
      { id: "b", type: "verse", label: "Verse 1", lines: [emptyLine("x"), emptyLine("y")] },
      { id: "c", type: "chorus", label: "Chorus 1", lines: [emptyLine("z"), emptyLine("w")] },
      { id: "d", type: "verse", label: "Verse 2", lines: [emptyLine("q"), emptyLine("r")] },
    ]
    const groups = balanceColumns(sections, (section) => section.lines.length + 1, 2)
    expect(groups.flat()).toHaveLength(4)
    expect(groups.every((group) => group.length > 0)).toBe(true)
  })
})