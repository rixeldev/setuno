import { describe, expect, it } from "vitest"

import { ANNOTATION_NOTES_LIMIT } from "@/libs/annotations"
import {
  annotationSnapshot,
  duplicateSongTitle,
  mergeAnnotationDocs,
  mergeCandidates,
  mergeCounts,
  readerStateCopy,
  repointSetlist,
  setlistReferencesSong,
  SONG_TITLE_LIMIT,
} from "@/libs/songMerge"
import type {
  AnnotationMarker,
  Setlist,
  SetlistSong,
  Song,
  SongSuggestion,
  TimestampLike,
} from "@/interfaces"

const TIMESTAMP: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const setlist = (overrides: Partial<Setlist> = {}): Setlist => ({
  id: "list-1",
  organizationId: "org-1",
  name: "Friday gig",
  description: "",
  date: null,
  notes: "",
  songs: [],
  blocks: [],
  estimatedDurationSec: 0,
  targetMinutes: 0,
  breakMinutes: 0,
  template: false,
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

const entry = (songId: string, overrides: Partial<SetlistSong> = {}): SetlistSong => ({
  songId,
  title: `Song ${songId}`,
  artist: "",
  key: "C",
  order: 0,
  note: "",
  ...overrides,
})

const song = (id: string, overrides: Partial<Song> = {}): Song => ({
  id,
  organizationId: "org-1",
  title: `Song ${id}`,
  artist: "",
  key: "C",
  originalKey: "C",
  capo: 0,
  bpm: null,
  durationSec: null,
  genre: "",
  notes: "",
  tags: [],
  sections: [],
  links: { youtube: "", spotify: "", appleMusic: "" },
  status: "active",
  deletedAt: null,
  deletedBy: null,
  createdBy: "uid-1",
  createdByName: "Rixel",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

const suggestion = (id: string, songId: string | null): SongSuggestion => ({
  id,
  organizationId: "org-1",
  songId,
  songTitle: "Song",
  authorId: "uid-2",
  authorName: "Ada",
  type: "other",
  change: { kind: "other" },
  summary: "",
  comment: "",
  status: "pending",
  createdAt: TIMESTAMP,
  reviewedBy: null,
  reviewedByName: null,
  reviewedAt: null,
  reviewNote: "",
})

const marker = (id: string, overrides: Partial<AnnotationMarker> = {}): AnnotationMarker => ({
  id,
  sectionId: "sec-1",
  lineIndex: 0,
  text: "cue",
  ...overrides,
})

describe("duplicateSongTitle", () => {
  it("appends the localized suffix", () => {
    expect(duplicateSongTitle("Wonderwall", " (copy)")).toBe("Wonderwall (copy)")
  })

  it("keeps an absurdly long title inside the rules limit", () => {
    const long = "A".repeat(SONG_TITLE_LIMIT)
    const title = duplicateSongTitle(long, " (copy)")
    expect(title).toHaveLength(SONG_TITLE_LIMIT)
    expect(title.endsWith(" (copy)")).toBe(false)
  })
})

describe("repointSetlist", () => {
  it("swaps every loser reference for the master and flags the change", () => {
    const plan = repointSetlist(
      setlist({
        songs: [
          entry("a", { order: 0, key: "G" }),
          entry("b", { order: 1, key: "D", note: "tune down" }),
          entry("c", { order: 2 }),
        ],
      }),
      "b",
      "a",
    )

    expect(plan.songIds).toEqual(["a", "c"])
    expect(plan.changed).toBe(true)
    // The loser's entry collapsed onto the master's slot, keeping the master's
    // own key and dropping the loser's note; `c` was untouched.
    expect(plan.songKeys).toEqual({ a: "G", c: "C" })
    expect(plan.songNotes).toEqual({})
  })

  it("reports no change for a list that never mentions the loser", () => {
    const plan = repointSetlist(setlist({ songs: [entry("a"), entry("c")] }), "b", "a")
    expect(plan.changed).toBe(false)
    expect(plan.songIds).toEqual(["a", "c"])
    expect(plan.songKeys).toEqual({ a: "C", c: "C" })
    expect(plan.blocks).toEqual([])
  })

  it("keeps one slot when both songs are in the list: first position, master's content", () => {
    const plan = repointSetlist(
      setlist({
        songs: [
          entry("b", { order: 0, key: "D", note: "loser note" }),
          entry("x", { order: 1 }),
          entry("a", { order: 2, key: "G", note: "keeper note" }),
        ],
      }),
      "b",
      "a",
    )

    expect(plan.songIds).toEqual(["a", "x"])
    // The slot the pair landed in is the loser's (order preserved for the gig)…
    expect(plan.songIds[0]).toBe("a")
    // …but the content is the kept song's own entry.
    expect(plan.songKeys).toEqual({ a: "G", x: "C" })
    expect(plan.songNotes).toEqual({ a: "keeper note" })
    expect(plan.changed).toBe(true)
  })

  it("lets an empty master key fall back to the master song instead of pinning it", () => {
    const plan = repointSetlist(
      setlist({
        songs: [entry("b", { key: "D" }), entry("a", { key: "" })],
      }),
      "b",
      "a",
    )

    expect(plan.songIds).toEqual(["a"])
    expect(plan.songKeys).not.toHaveProperty("a")
    expect(plan.songNotes).toEqual({})
    expect(plan.changed).toBe(true)
  })

  it("never writes empty keys or notes", () => {
    const plan = repointSetlist(setlist({ songs: [entry("b", { key: "", note: "" })] }), "b", "a")
    expect(plan.songKeys).toEqual({})
    expect(plan.songNotes).toEqual({})
    expect(plan.changed).toBe(true)
  })

  it("re-anchors dividers to the master and leaves the rest untouched", () => {
    const original = setlist({
      songs: [entry("b"), entry("a")],
      blocks: [
        { id: "blk-1", name: "Set 1", afterSongId: "b" },
        { id: "blk-2", name: "Encore", afterSongId: "a" },
        { id: "blk-3", name: null as unknown as string, afterSongId: null },
      ],
    })
    const plan = repointSetlist(original, "b", "a")

    expect(plan.blocks[0]).toEqual({ id: "blk-1", name: "Set 1", afterSongId: "a" })
    expect(plan.blocks[1]).toBe(original.blocks[1])
    expect(plan.blocks[2]).toBe(original.blocks[2])
    expect(plan.changed).toBe(true)
  })

  it("flags a divider-only reference", () => {
    const plan = repointSetlist(
      setlist({ songs: [entry("a")], blocks: [{ id: "blk-1", name: "Break", afterSongId: "b" }] }),
      "b",
      "a",
    )
    expect(plan.songIds).toEqual(["a"])
    expect(plan.blocks[0].afterSongId).toBe("a")
    expect(plan.changed).toBe(true)
  })
})

describe("setlistReferencesSong", () => {
  it("sees entries, dividers, and nothing", () => {
    expect(
      setlistReferencesSong(setlist({ songs: [entry("a"), entry("b")] }), "b"),
    ).toBe(true)
    expect(
      setlistReferencesSong(
        setlist({ blocks: [{ id: "blk-1", name: "Break", afterSongId: "b" }] }),
        "b",
      ),
    ).toBe(true)
    expect(setlistReferencesSong(setlist({ songs: [entry("a")] }), "b")).toBe(false)
  })
})

describe("mergeCounts", () => {
  it("counts the lists and suggestions that actually point at the loser", () => {
    const counts = mergeCounts(
      [
        setlist({ songs: [entry("loser"), entry("a")] }),
        setlist({ songs: [entry("a")] }),
        setlist({ blocks: [{ id: "blk-1", name: "Set 2", afterSongId: "loser" }] }),
      ],
      [
        suggestion("s1", "loser"),
        suggestion("s2", "a"),
        suggestion("s3", null),
      ],
      "loser",
    )

    expect(counts).toEqual({ setlists: 2, suggestions: 1 })
  })
})

describe("mergeCandidates", () => {
  it("ranks same-title matches first, same artist ahead of uncredited artist", () => {
    const current = song("here", { title: "Hotel California", artist: "Eagles" })
    const candidates = [
      song("unrelated", { title: "Zebra" }),
      // Same title with no artist on either side is a match (the #39 matcher
      // skips only pairs where *both* credit a different artist).
      song("uncredited", { title: "Hotel California", artist: "" }),
      song("mine", { title: "Hotel California", artist: "Eagles" }),
      song("acoustic", { title: "Acoustic Medley" }),
    ]

    const ranked = mergeCandidates(candidates, current)

    expect(ranked.map((item) => item.song.id)).toEqual([
      "mine",
      "uncredited",
      "acoustic",
      "unrelated",
    ])
    expect(ranked[0].sameTitle).toBe(true)
    expect(ranked[1].sameTitle).toBe(true)
    expect(ranked[2].sameTitle).toBe(false)
  })

  it("excludes the song being merged away from", () => {
    const current = song("here")
    const ranked = mergeCandidates([song("here"), song("other")], current)
    expect(ranked.map((item) => item.song.id)).toEqual(["other"])
  })
})

describe("mergeAnnotationDocs", () => {
  it("does nothing without a loser document", () => {
    expect(mergeAnnotationDocs({ notes: "mine", markers: [] }, null)).toEqual({
      merged: null,
      complete: true,
    })
  })

  it("moves the loser over wholesale when the master has none", () => {
    const loser = { notes: "keep me", markers: [marker("m1")] }
    expect(mergeAnnotationDocs(null, loser)).toEqual({ merged: loser, complete: true })
  })

  it("concatenates notes master-first and appends markers", () => {
    const result = mergeAnnotationDocs(
      { notes: "master notes", markers: [marker("m1", { text: "first" })] },
      { notes: "loser notes", markers: [marker("m2", { text: "second" })] },
    )

    expect(result.complete).toBe(true)
    expect(result.merged?.notes).toBe("master notes\n\nloser notes")
    expect(result.merged?.markers.map((item) => item.id)).toEqual(["m1", "m2"])
  })

  it("drops blank halves so the join never starts with a separator", () => {
    const result = mergeAnnotationDocs(
      { notes: "", markers: [] },
      { notes: "only loser", markers: [] },
    )
    expect(result.merged?.notes).toBe("only loser")
  })

  it("dedupes markers the two documents share by id", () => {
    const result = mergeAnnotationDocs(
      { notes: "", markers: [marker("m1", { text: "from master" })] },
      { notes: "", markers: [marker("m1", { text: "from loser" }), marker("m2")] },
    )
    expect(result.merged?.markers).toHaveLength(2)
    expect(result.merged?.markers[0].text).toBe("from master")
  })

  it("touches neither document when the notes would overflow the rules", () => {
    const result = mergeAnnotationDocs(
      { notes: "a".repeat(ANNOTATION_NOTES_LIMIT - 10), markers: [] },
      { notes: "b".repeat(20), markers: [] },
    )
    expect(result).toEqual({ merged: null, complete: false })
  })

  it("keeps the loser's document when the markers would overflow the rules", () => {
    const master = { notes: "", markers: Array.from({ length: 30 }, (_, i) => marker(`m${i}`)) }
    const loser = { notes: "", markers: Array.from({ length: 25 }, (_, i) => marker(`l${i}`)) }
    const result = mergeAnnotationDocs(master, loser)
    expect(result).toEqual({ merged: null, complete: false })
  })
})

describe("readerStateCopy", () => {
  it("copies only whitelisted fields and clamps anything out of range", () => {
    const copied = readerStateCopy({
      autoscrollSpeed: 30,
      autoscrollDelay: 9999,
      scrollRatio: 4,
      semitones: 40,
      capo: -3,
      fontSize: 99,
      songId: "should-not-survive",
      junk: "nope",
    })

    expect(copied).toEqual({
      autoscrollSpeed: 30,
      autoscrollDelay: 15,
      scrollRatio: 1,
      semitones: 11,
      capo: 0,
      fontSize: 30,
    })
    expect(copied).not.toHaveProperty("songId")
    expect(copied).not.toHaveProperty("junk")
  })

  it("skips fields that are missing or not numbers", () => {
    expect(readerStateCopy({ scrollRatio: "half", fontSize: null })).toEqual({})
  })
})

describe("annotationSnapshot", () => {
  it("sanitizes a stored document the way the reader reads it", () => {
    const snapshot = annotationSnapshot({
      notes: "n".repeat(ANNOTATION_NOTES_LIMIT + 50),
      markers: [
        { id: "m1", sectionId: "sec-1", lineIndex: 2, text: "cue" },
        { id: "bad", sectionId: "", lineIndex: 0, text: "no section" },
        "not-an-object",
      ],
      updatedAt: TIMESTAMP,
    })

    expect(snapshot.notes).toHaveLength(ANNOTATION_NOTES_LIMIT)
    expect(snapshot.markers).toHaveLength(1)
    expect(snapshot.markers[0].lineIndex).toBe(2)
  })
})
