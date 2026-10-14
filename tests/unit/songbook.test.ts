import { describe, expect, it } from "vitest"

import { EMPTY_SONG_LINKS, type Song } from "@/interfaces/song"
import type { TimestampLike } from "@/interfaces/timestamp"
import { DEFAULT_SORT, SONG_SORTS, sortSongs, type SongSort } from "@/libs/songbookSort"
import { EMPTY_SONGBOOK, sanitizeSongbook, songbookKey } from "@/libs/songbookState"

/** A timestamp `seconds` into the epoch, shaped like a Firestore one. */
const timestamp = (seconds: number): TimestampLike => ({
  seconds,
  nanoseconds: 0,
  toDate: () => new Date(seconds * 1000),
})

const song = (id: string, patch: Partial<Song> = {}): Song => ({
  id,
  organizationId: "org",
  title: id,
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
  links: EMPTY_SONG_LINKS,
  createdBy: "uid",
  createdByName: "Admin",
  createdAt: timestamp(0),
  updatedAt: timestamp(0),
  ...patch,
})

const titles = (songs: Song[]): string[] => songs.map((entry) => entry.title)

describe("sortSongs", () => {
  it("returns a new array instead of rewriting the library", () => {
    const source = [song("B"), song("A"), song("C")]
    const ordered = sortSongs(source, "title")
    expect(titles(source)).toEqual(["B", "A", "C"])
    expect(ordered).not.toBe(source)
  })

  it("reads title up and back down", () => {
    const source = [song("Cider"), song("Apple"), song("Banana")]
    expect(titles(sortSongs(source, "title"))).toEqual(["Apple", "Banana", "Cider"])
    expect(titles(sortSongs(source, "titleDesc"))).toEqual(["Cider", "Banana", "Apple"])
  })

  it("puts songs with no artist at the end of an artist sort", () => {
    const source = [
      song("Zebra", { artist: "Alpha" }),
      song("Apple", { artist: "Beta" }),
      song("Solo", { artist: "" }),
      song("Bare", { artist: "   " }),
    ]
    expect(titles(sortSongs(source, "artist"))).toEqual(["Zebra", "Apple", "Solo", "Bare"])
  })

  it("breaks an artist tie by title", () => {
    const source = [song("Later", { artist: "Same" }), song("Earlier", { artist: "Same" })]
    expect(titles(sortSongs(source, "artist"))).toEqual(["Earlier", "Later"])
  })

  it("lists the newest first and sinks a document with no timestamp", () => {
    const source = [
      song("Oldest", { createdAt: timestamp(100) }),
      song("Newest", { createdAt: timestamp(900) }),
      song("Middle", { createdAt: timestamp(500) }),
      // A damaged document must not sort to the top and call itself new.
      song("Broken", { createdAt: undefined as unknown as TimestampLike }),
    ]
    expect(titles(sortSongs(source, "added"))).toEqual(["Newest", "Middle", "Oldest", "Broken"])
  })

  it("runs tempo and length up, leaving what cannot be measured until last", () => {
    const source = [
      song("Unknown tempo"),
      song("Fast", { bpm: 200 }),
      song("Slow", { bpm: 80 }),
      song("Mid", { bpm: 140 }),
    ]
    expect(titles(sortSongs(source, "tempo"))).toEqual(["Slow", "Mid", "Fast", "Unknown tempo"])

    const lengths = [
      song("Unknown length"),
      song("Long", { durationSec: 400 }),
      song("Short", { durationSec: 60 }),
    ]
    expect(titles(sortSongs(lengths, "length"))).toEqual(["Short", "Long", "Unknown length"])
  })

  it("keeps a song whose tempo is zero out of the measured run", () => {
    const source = [song("Zero", { bpm: 0 }), song("Real", { bpm: 120 }), song("None")]
    // Zero means "unset", not "beats so slow they are off the chart".
    expect(titles(sortSongs(source, "tempo"))).toEqual(["Real", "None", "Zero"])
  })

  it("handles empty and single-song lists", () => {
    expect(sortSongs([], "title")).toEqual([])
    expect(titles(sortSongs([song("Only")], "added"))).toEqual(["Only"])
  })

  it("supports every offered order", () => {
    const source = [song("B", { artist: "A", bpm: 100 }), song("A", { artist: "B", bpm: 90 })]
    for (const order of SONG_SORTS) {
      expect(sortSongs(source, order)).toHaveLength(2)
    }
    expect(SONG_SORTS).toContain(DEFAULT_SORT)
  })

  it("falls back to the default rather than throwing on an unknown order", () => {
    const source = [song("B"), song("A")]
    expect(titles(sortSongs(source, "nonsense" as SongSort))).toEqual(["A", "B"])
  })
})

describe("songbookKey", () => {
  it("separates one band's entry from another user's", () => {
    expect(songbookKey("org1", "uid1")).not.toBe(songbookKey("org2", "uid1"))
    expect(songbookKey("org1", "uid1")).not.toBe(songbookKey("org1", "uid2"))
  })

  it("never produces a usable key from a missing identity", () => {
    expect(songbookKey(null, null)).toBe("/")
    expect(songbookKey(undefined, "uid")).toBe("/uid")
  })
})

describe("sanitizeSongbook", () => {
  it("passes a saved entry through untouched", () => {
    const saved = {
      filters: {
        search: "wal",
        artist: "Radiohead",
        genre: "Rock",
        key: "Am",
        tag: "live",
        progression: "Am F C G",
        bpm: "slow" as const,
        duration: "long" as const,
      },
      sort: "artist" as const,
    }
    expect(sanitizeSongbook(saved)).toEqual(saved)
  })

  it("opens with the defaults when storage held nothing usable", () => {
    expect(sanitizeSongbook(null)).toEqual(EMPTY_SONGBOOK)
    expect(sanitizeSongbook("garbage")).toEqual(EMPTY_SONGBOOK)
    expect(sanitizeSongbook(42)).toEqual(EMPTY_SONGBOOK)
    expect(sanitizeSongbook([])).toEqual(EMPTY_SONGBOOK)
  })

  it("drops an order the app no longer offers instead of sorting by nothing", () => {
    expect(sanitizeSongbook({ sort: "byMood" }).sort).toBe(DEFAULT_SORT)
    expect(sanitizeSongbook({ sort: 7 }).sort).toBe(DEFAULT_SORT)
  })

  it("drops a bucket a newer version removed rather than filtering forever", () => {
    const result = sanitizeSongbook({ filters: { bpm: "glacial", duration: "epic" }, sort: "title" })
    expect(result.filters.bpm).toBeNull()
    expect(result.filters.duration).toBeNull()
    // …while the rest of the entry survives.
    expect(result.sort).toBe("title")
  })

  it("reads an empty facet as no facet at all", () => {
    const result = sanitizeSongbook({ filters: { artist: "", genre: "  ", key: null } })
    expect(result.filters.artist).toBeNull()
    expect(result.filters.genre).toBeNull()
    expect(result.filters.key).toBeNull()
  })

  it("rebuilds every field when storage gives back a partial entry", () => {
    const result = sanitizeSongbook({ filters: { search: "hi" } })
    expect(result.filters.search).toBe("hi")
    expect(result.filters.progression).toBe("")
    expect(result.filters.artist).toBeNull()
    expect(result.sort).toBe(DEFAULT_SORT)
  })

  it("ignores fields it does not know about", () => {
    const result = sanitizeSongbook({ sort: "tempo", futureField: { nested: true } })
    expect(result.sort).toBe("tempo")
    expect(Object.keys(result)).toEqual(["filters", "sort"])
  })
})
