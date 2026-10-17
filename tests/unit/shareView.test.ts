import { describe, expect, it } from "vitest"

import { sharedSections, sharedSetlistRows } from "../../libs/shareView"
import type { SharedSetlistPayload } from "../../functions/src/shares"

/**
 * The public reader's view layer (roadmap #56): payload → the types the app
 * renders. The one rule worth pinning here is that an unknown section type
 * degrades to `custom` with its stored label instead of rendering blank — the
 * callable must never mirror the app's section-type union.
 */

describe("sharedSections", () => {
  it("maps a well-formed section into the app shape", () => {
    const [mapped] = sharedSections([
      {
        id: "sec-1",
        type: "chorus",
        label: "Chorus 1",
        bars: 8,
        lines: [{ text: "hello", chords: [{ chord: "G", position: 0 }] }],
      },
    ])
    expect(mapped).toEqual({
      id: "sec-1",
      type: "chorus",
      label: "Chorus 1",
      bars: 8,
      lines: [{ text: "hello", chords: [{ chord: "G", position: 0 }] }],
    })
  })

  it("degrades an unknown type to custom, keeping its label", () => {
    const [mapped] = sharedSections([
      { id: "s", type: "bridge-not-yet-known", label: "Breakdown", bars: null, lines: [] },
    ])
    expect(mapped.type).toBe("custom")
    expect(mapped.label).toBe("Breakdown")
  })

  it("drops the bars field when unset and recovers a missing id", () => {
    const sections = sharedSections([
      { id: "", type: "verse", label: "", bars: null, lines: [] },
      { id: "b", type: "verse", label: "", bars: 0, lines: [] },
    ])
    expect(sections[0].id).toBe("sec_0")
    expect(sections[0].label).toBe("Section")
    expect("bars" in sections[0]).toBe(false)
    expect("bars" in sections[1]).toBe(false)
  })

  it("does not mutate the payload it maps", () => {
    const source = [
      { id: "s", type: "verse", label: "V", bars: 4, lines: [{ text: "a", chords: [] }] },
    ]
    const copy = JSON.parse(JSON.stringify(source)) as typeof source
    sharedSections(source)
    expect(source).toEqual(copy)
  })
})

describe("sharedSetlistRows", () => {
  const payload = (overrides: Partial<SharedSetlistPayload>): SharedSetlistPayload => ({
    date: null,
    entries: [],
    dividers: [],
    ...overrides,
  })

  const entry = (songId: string, title: string) => ({
    songId,
    title,
    artist: "",
    key: "",
    note: "",
  })

  it("numbers songs only, dividers aside", () => {
    const rows = sharedSetlistRows(
      payload({ entries: [entry("a", "Alpha"), entry("b", "Bravo")] }),
    )
    expect(rows).toEqual([
      { kind: "song", entry: entry("a", "Alpha"), index: 1 },
      { kind: "song", entry: entry("b", "Bravo"), index: 2 },
    ])
  })

  it("anchors a divider after its song and a null anchor at the top", () => {
    const rows = sharedSetlistRows(
      payload({
        entries: [entry("a", "Alpha"), entry("b", "Bravo")],
        dividers: [
          { name: "Set 2", afterSongId: "a" },
          { name: "Opener", afterSongId: null },
        ],
      }),
    )
    expect(rows.map((row) => (row.kind === "divider" ? row.name : row.entry.title))).toEqual([
      "Opener",
      "Alpha",
      "Set 2",
      "Bravo",
    ])
  })

  it("shows a divider whose song left the list after the last song, never hidden", () => {
    const rows = sharedSetlistRows(
      payload({
        entries: [entry("a", "Alpha")],
        dividers: [{ name: "Encore", afterSongId: "gone" }],
      }),
    )
    expect(rows.map((row) => row.kind)).toEqual(["song", "divider"])
  })

  it("keeps multiple dividers on one anchor in payload order", () => {
    const rows = sharedSetlistRows(
      payload({
        entries: [entry("a", "Alpha")],
        dividers: [
          { name: "Break", afterSongId: "a" },
          { name: "Set 2", afterSongId: "a" },
        ],
      }),
    )
    expect(rows.map((row) => (row.kind === "divider" ? row.name : row.entry.title))).toEqual([
      "Alpha",
      "Break",
      "Set 2",
    ])
  })
})
