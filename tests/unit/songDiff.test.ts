import { describe, expect, it } from "vitest"

import { DIFF_TOKEN_LIMIT, diffChordLine, diffWords, type DiffSegment } from "@/libs/songDiff"
import { buildChordRow } from "@/libs/songUtils"

const text = (segments: DiffSegment[]): string => segments.map((segment) => segment.text).join("")
const ofKind = (segments: DiffSegment[], kind: DiffSegment["kind"]): DiffSegment[] =>
  segments.filter((segment) => segment.kind === kind)
/** Concatenates the runs of the given kinds **in order**, as they render. */
const reconstruct = (segments: DiffSegment[], kinds: DiffSegment["kind"][]): string =>
  segments
    .filter((segment) => kinds.includes(segment.kind))
    .map((segment) => segment.text)
    .join("")

describe("diffWords", () => {
  it("reports an unchanged line as a single run", () => {
    expect(diffWords("the quick brown fox", "the quick brown fox")).toEqual([
      { kind: "same", text: "the quick brown fox" },
    ])
    expect(diffWords("", "")).toEqual([])
  })

  it("marks only the word that changed, keeping the spaces around it", () => {
    expect(diffWords("the quick brown fox", "the fast brown fox")).toEqual([
      { kind: "same", text: "the " },
      { kind: "removed", text: "quick" },
      { kind: "added", text: "fast" },
      { kind: "same", text: " brown fox" },
    ])
  })

  it("reads a pure insertion and a pure removal", () => {
    expect(diffWords("", "hello")).toEqual([{ kind: "added", text: "hello" }])
    expect(diffWords("hello", "")).toEqual([{ kind: "removed", text: "hello" }])
  })

  it("does not mark every word when only the indentation moved", () => {
    const segments = diffWords("  hello world", "hello world")
    expect(ofKind(segments, "removed")).toEqual([{ kind: "removed", text: "  " }])
    expect(ofKind(segments, "added")).toEqual([])
  })

  it("paints the padding that follows a wider chord — why chord rows use diffChordLine", () => {
    // Replacing C with Cm shifts every space after it, so a word diff marks the
    // whole gap. That is correct, and it is exactly why the review screen draws
    // chord rows through `diffChordLine`, which marks the chord alone.
    const segments = diffWords("Am F     C      G", "Am F     Cm     G")
    expect(reconstruct(segments, ["same", "added"])).toBe("Am F     Cm     G")
    expect(reconstruct(segments, ["same", "removed"])).toBe("Am F     C      G")
  })

  it("never loses a character: the segments partition both sides", () => {
    const cases: [string, string][] = [
      ["hello world", "hello brave world"],
      ["Am F C G", "Am Em F C G"],
      ["one", "two"],
      ["same", "same"],
      ["", ""],
    ]
    for (const [from, to] of cases) {
      const segments = diffWords(from, to)
      // Everything marked as kept or removed came from `from`…
      expect(reconstruct(segments, ["same", "removed"])).toBe(from)
      // …and everything kept or added is `to`.
      expect(reconstruct(segments, ["same", "added"])).toBe(to)
    }
  })

  it("gives up past the token limit instead of building a huge table", () => {
    const words = Array.from({ length: DIFF_TOKEN_LIMIT + 1 }, (_, index) => `w${index}`).join(" ")
    expect(diffWords(words, `${words}!`)).toEqual([
      { kind: "removed", text: words },
      { kind: "added", text: `${words}!` },
    ])
    // …while a long line under the limit is still diffed word by word.
    const short = Array.from({ length: 60 }, (_, index) => `w${index}`).join(" ")
    expect(diffWords(short, short)).toEqual([{ kind: "same", text: short }])
  })
})

describe("diffChordLine", () => {
  const line = {
    text: "Hey Jude, don't make it bad",
    chords: [
      { chord: "C", position: 0 },
      { chord: "G", position: 10 },
    ],
  }

  it("marks the changed chord and draws the grid the proposal would", () => {
    const segments = diffChordLine(line, { position: 0, from: "C", to: "Am" })
    expect(ofKind(segments, "removed")).toEqual([{ kind: "removed", text: "C" }])
    expect(ofKind(segments, "added")).toEqual([{ kind: "added", text: "Am" }])
    // The proposal is byte-exact: struck and marked runs are adjacent, so the
    // padding that follows is the proposal's, and that is what gets drawn.
    expect(reconstruct(segments, ["same", "added"])).toBe(
      buildChordRow(
        [
          { chord: "Am", position: 0 },
          { chord: "G", position: 10 },
        ],
        line.text,
      ),
    )
    // The struck run is today's chord; it deliberately does not try to keep
    // today's padding (it would have to guess the proposal's width to do it).
    expect(reconstruct(segments, ["same", "removed"]).startsWith("C        G")).toBe(true)
  })

  it("reconstructs both rows exactly when the chord widths match", () => {
    const segments = diffChordLine(line, { position: 0, from: "C", to: "D" })
    expect(reconstruct(segments, ["same", "removed"])).toBe(buildChordRow(line.chords, line.text))
    expect(reconstruct(segments, ["same", "added"])).toBe(
      buildChordRow(
        [
          { chord: "D", position: 0 },
          { chord: "G", position: 10 },
        ],
        line.text,
      ),
    )
  })

  it("marks only the new chord where none sits yet", () => {
    const segments = diffChordLine(line, { position: 5, from: "", to: "F" })
    expect(ofKind(segments, "removed")).toEqual([])
    expect(ofKind(segments, "added")).toEqual([{ kind: "added", text: "F" }])
  })

  it("keeps a deleted chord in the grid so the reviewer sees what goes", () => {
    const segments = diffChordLine(line, { position: 10, from: "G", to: "" })
    expect(ofKind(segments, "added")).toEqual([])
    expect(ofKind(segments, "removed")).toEqual([{ kind: "removed", text: "G" }])
    expect(text(segments)).toBe(buildChordRow(line.chords, line.text))
  })

  it("trusts the song over the suggestion's own idea of the current chord", () => {
    // The song has moved on: the chord is C now, whatever the suggestion claims.
    const segments = diffChordLine(line, { position: 0, from: "D", to: "Am" })
    expect(ofKind(segments, "removed")).toEqual([{ kind: "removed", text: "C" }])
  })

  it("falls back to the suggested chord when the song no longer has one there", () => {
    const segments = diffChordLine(line, { position: 14, from: "F", to: "Dm" })
    expect(ofKind(segments, "removed")).toEqual([{ kind: "removed", text: "F" }])
    expect(ofKind(segments, "added")).toEqual([{ kind: "added", text: "Dm" }])
  })

  it("marks nothing when neither side names a chord", () => {
    const segments = diffChordLine(line, { position: 0, from: "", to: "" })
    expect(ofKind(segments, "removed")).toEqual([])
    expect(ofKind(segments, "added")).toEqual([])
    expect(text(segments)).toBe(buildChordRow(line.chords, line.text))
  })

  it("survives a line the song has no chords in, falling back to the suggestion's own", () => {
    const segments = diffChordLine({ text: "la la la", chords: [] }, { position: 0, from: "C", to: "G" })
    expect(ofKind(segments, "removed")).toEqual([{ kind: "removed", text: "C" }])
    expect(ofKind(segments, "added")).toEqual([{ kind: "added", text: "G" }])
    expect(reconstruct(segments, ["same", "added"])).toBe(
      buildChordRow([{ chord: "G", position: 0 }], "la la la"),
    )
  })
})
