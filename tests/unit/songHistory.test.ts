import { describe, expect, it } from "vitest"

import type { Song, SongInput, SongSection } from "@/interfaces"
import {
  SONG_VERSION_CAP,
  compareVersionsDesc,
  songVersionData,
  sortVersionsDesc,
  versionDiff,
  versionsToPrune,
} from "@/libs/songHistory"

const line = (text: string, chords: string[] = []) => ({
  text,
  chords: chords.map((chord, index) => ({ chord, position: index * 4 })),
})

const section = (id: string, label: string, lines = [line("hello")]): SongSection => ({
  id,
  type: "verse",
  label,
  lines,
})

const songInput = (overrides: Partial<SongInput> = {}): SongInput => ({
  title: "Song",
  artist: "Artist",
  key: "G",
  originalKey: "G",
  capo: 0,
  bpm: 120,
  durationSec: null,
  genre: "",
  notes: "",
  tags: [],
  sections: [section("s1", "Verse 1")],
  links: { youtube: "", spotify: "", appleMusic: "" },
  status: "active",
  ...overrides,
})

const version = (id: string, seconds: number) => ({
  id,
  savedAt: { seconds, nanoseconds: 0, toDate: () => new Date(seconds * 1000) },
})

describe("songVersionData", () => {
  it("keeps exactly the content a restore writes back", () => {
    const song = {
      id: "song1",
      organizationId: "org1",
      ...songInput(),
      createdBy: "u1",
      createdByName: "Ana",
      createdAt: null,
      updatedAt: null,
    } as unknown as Song

    const data = songVersionData(song)

    expect(data).toEqual(songInput())
    expect(Object.keys(data)).not.toContain("id")
    expect(Object.keys(data)).not.toContain("organizationId")
    expect(Object.keys(data)).not.toContain("createdBy")
  })
})

describe("versionsToPrune", () => {
  it("prunes nothing while the history fits the cap", () => {
    const versions = Array.from({ length: SONG_VERSION_CAP }, (_, index) =>
      version(`v${index}`, 1000 + index),
    )
    expect(versionsToPrune(versions)).toEqual([])
  })

  it("drops the oldest beyond the cap, whatever the input order", () => {
    const versions = [
      version("old", 100),
      ...Array.from({ length: SONG_VERSION_CAP }, (_, index) => version(`v${index}`, 500 + index)),
    ]
    expect(versionsToPrune(versions)).toEqual(["old"])
  })

  it("breaks exact-time ties by id so the choice is deterministic", () => {
    const versions = [
      version("a", 100),
      version("b", 100),
      // Cap minus the tie pair: one slot beyond the cap, so exactly the last
      // of the tie pair is pruned — never an arbitrary member of it.
      ...Array.from({ length: SONG_VERSION_CAP - 1 }, (_, index) => version(`v${index}`, 500 + index)),
    ]
    // Ties sort id-desc, so with the cap full the loser is the last of the
    // tie pair — the same answer on every run and every device.
    expect(versionsToPrune(versions)).toEqual(["a"])
    expect(compareVersionsDesc(version("b", 100), version("a", 100))).toBeLessThan(0)
    // The tied pair sorts id-desc at the tail: b before a, hence a is the cut.
    expect(sortVersionsDesc(versions).slice(-2).map((entry) => entry.id)).toEqual(["b", "a"])
  })

  it("orders by saved time, newest first", () => {
    const sorted = sortVersionsDesc([version("early", 100), version("late", 300), version("mid", 200)])
    expect(sorted.map((entry) => entry.id)).toEqual(["late", "mid", "early"])
  })
})

describe("versionDiff", () => {
  it("reports no change between identical states", () => {
    const diff = versionDiff(songInput(), songInput())
    expect(diff.changed).toBe(false)
    expect(diff.fields).toEqual([])
    expect(diff.sections).toEqual([])
  })

  it("marks changed metadata field by field", () => {
    const diff = versionDiff(
      songInput({ key: "G", bpm: 120, tags: ["rock"] }),
      songInput({ key: "D", bpm: 132, tags: ["rock", "encore"] }),
    )

    expect(diff.changed).toBe(true)
    expect(diff.fields.map((field) => field.field)).toEqual(["key", "bpm", "tags"])
    const key = diff.fields.find((field) => field.field === "key")
    expect(key?.segments.some((segment) => segment.kind === "removed" && segment.text.includes("G"))).toBe(true)
    expect(key?.segments.some((segment) => segment.kind === "added" && segment.text.includes("D"))).toBe(true)
  })

  it("reports a status change like any other field", () => {
    const diff = versionDiff(
      songInput({ status: "draft" }),
      songInput({ status: "retired" }),
    )

    expect(diff.changed).toBe(true)
    expect(diff.fields).toHaveLength(1)
    expect(diff.fields[0].field).toBe("status")
    expect(diff.fields[0].segments.some((segment) => segment.kind === "removed")).toBe(true)
    expect(diff.fields[0].segments.some((segment) => segment.kind === "added")).toBe(true)
  })

  it("marks an edited lyric line inside a paired section", () => {
    const before = songInput({ sections: [section("s1", "Verse 1", [line("hello there")])] })
    const after = songInput({ sections: [section("s1", "Verse 1", [line("hello world")])] })

    const diff = versionDiff(before, after)

    expect(diff.sections).toHaveLength(1)
    const entry = diff.sections[0]
    expect(entry.kind).toBe("changed")
    expect(entry.before?.id).toBe("s1")
    expect(entry.after?.id).toBe("s1")
    expect(entry.lines[0].kind).toBe("changed")
    expect(entry.lines[0].lyrics.some((segment) => segment.kind === "removed")).toBe(true)
    expect(entry.lines[0].lyrics.some((segment) => segment.kind === "added")).toBe(true)
    expect(entry.lines[0].chords).toBeNull()
  })

  it("diffs a line's progression when its chords change", () => {
    const before = songInput({
      sections: [section("s1", "Verse 1", [line("la la", ["G", "Am"])])],
    })
    const after = songInput({
      sections: [section("s1", "Verse 1", [line("la la", ["G", "C", "Am"])])],
    })

    const diff = versionDiff(before, after)

    const chords = diff.sections[0].lines[0].chords
    expect(chords).not.toBeNull()
    expect(chords?.some((segment) => segment.kind === "added" && segment.text.includes("C"))).toBe(true)
  })

  it("shows an inserted section whole, and skips its unchanged neighbour", () => {
    const before = songInput({ sections: [section("s1", "Verse 1")] })
    const after = songInput({ sections: [section("s1", "Verse 1"), section("s2", "Chorus")] })

    const diff = versionDiff(before, after)

    expect(diff.sections).toHaveLength(1)
    expect(diff.sections[0].kind).toBe("added")
    expect(diff.sections[0].before).toBeNull()
    expect(diff.sections[0].after?.id).toBe("s2")
  })

  it("places a removed section right before the section that followed it", () => {
    const before = songInput({
      sections: [section("s1", "Verse 1"), section("s2", "Pre"), section("s3", "Chorus", [line("sing")])],
    })
    const after = songInput({ sections: [section("s1", "Verse 1"), section("s3", "Chorus", [line("sing loud")])] })

    const diff = versionDiff(before, after)

    // s2 (removed) is anchored to s3, so it comes first; s3 is paired.
    expect(diff.sections.map((entry) => entry.kind)).toEqual(["removed", "changed"])
    expect(diff.sections[0].before?.id).toBe("s2")
    expect(diff.sections[1].after?.id).toBe("s3")
  })

  it("anchors a leading removal to the next survivor, and a trailing one to the end", () => {
    const leading = versionDiff(
      songInput({ sections: [section("s1", "Intro"), section("s2", "Verse 1")] }),
      songInput({ sections: [section("s2", "Verse 1")] }),
    )
    expect(leading.sections).toHaveLength(1)
    expect(leading.sections[0].kind).toBe("removed")
    expect(leading.sections[0].before?.id).toBe("s1")

    const trailing = versionDiff(
      songInput({ sections: [section("s1", "Verse 1"), section("s2", "Outro")] }),
      songInput({ sections: [section("s1", "Verse 1")] }),
    )
    expect(trailing.sections).toHaveLength(1)
    expect(trailing.sections[0].kind).toBe("removed")
    expect(trailing.sections[0].before?.id).toBe("s2")
  })

  it("pairs a moved section instead of reporting a delete plus an add", () => {
    const before = songInput({ sections: [section("a", "Verse 1"), section("b", "Chorus", [line("old")])] })
    const after = songInput({ sections: [section("b", "Chorus", [line("new")]), section("a", "Verse 1")] })

    const diff = versionDiff(before, after)

    expect(diff.sections).toHaveLength(1)
    expect(diff.sections[0].kind).toBe("changed")
    expect(diff.sections[0].after?.id).toBe("b")
  })

  it("counts a header-only edit (a type change) as a change", () => {
    const beforeSection: SongSection = { ...section("s1", "Verse 1"), type: "verse" }
    const afterSection: SongSection = { ...section("s1", "Chorus"), type: "chorus" }

    const diff = versionDiff(
      songInput({ sections: [beforeSection] }),
      songInput({ sections: [afterSection] }),
    )

    expect(diff.sections).toHaveLength(1)
    expect(diff.sections[0].kind).toBe("changed")
    expect(diff.sections[0].lines.every((entry) => entry.kind === "same")).toBe(true)
  })

  it("marks a line the edit added at the end of a section", () => {
    const before = songInput({ sections: [section("s1", "Verse 1", [line("one")])] })
    const after = songInput({ sections: [section("s1", "Verse 1", [line("one"), line("two")])] })

    const diff = versionDiff(before, after)

    const lines = diff.sections[0].lines
    expect(lines).toHaveLength(2)
    expect(lines[0].kind).toBe("same")
    expect(lines[1].kind).toBe("added")
  })
})
