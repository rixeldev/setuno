import { describe, expect, it } from "vitest"

import { EMPTY_SONG_LINKS, type Song } from "@/interfaces/song"
import type { TimestampLike } from "@/interfaces/timestamp"
import { DEFAULT_SORT, SONG_SORTS, sortSongs, type SongSort } from "@/libs/songbookSort"
import { EMPTY_FILTERS } from "@/libs/songSearch"
import {
  EMPTY_SONGBOOK,
  MAX_SONGBOOK_VIEWS,
  nextSongbookViewId,
  removeSongbookView,
  sanitizeSongbook,
  sanitizeSongbookViews,
  songbookKey,
  upsertSongbookView,
  type SongbookView,
} from "@/libs/songbookState"

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
      views: [],
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
    expect(Object.keys(result)).toEqual(["filters", "sort", "views"])
  })

  it("keeps a stored view out of the live filters", () => {
    const entry = sanitizeSongbook({
      filters: { search: "" },
      sort: "title",
      views: [{ id: "v1", name: "Slow", filters: { bpm: "slow" }, sort: "tempo" }],
    })
    expect(entry.views).toHaveLength(1)
    expect(entry.views[0]?.filters.bpm).toBe("slow")
    // Saving a view must not apply it: the list you are looking at is unchanged.
    expect(entry.filters.bpm).toBeNull()
  })
})

describe("songbook views (roadmap #37 part B)", () => {
  const view = (id: string, name: string, overrides: Partial<SongbookView> = {}): SongbookView => ({
    id,
    name,
    filters: EMPTY_FILTERS,
    sort: "title",
    ...overrides,
  })

  it("rebuilds a stored view, trimming the name and re-sanitizing both halves", () => {
    const [stored] = sanitizeSongbookViews([
      {
        id: "v1",
        name: "  Sunday acoustic ",
        filters: { artist: "Radiohead", bpm: "glacial", progression: "Am F" },
        sort: "byMood",
      },
    ])
    expect(stored?.name).toBe("Sunday acoustic")
    expect(stored?.filters.artist).toBe("Radiohead")
    expect(stored?.filters.progression).toBe("Am F")
    // A bucket and an order the app no longer offers cannot survive inside a view.
    expect(stored?.filters.bpm).toBeNull()
    expect(stored?.sort).toBe(DEFAULT_SORT)
  })

  it("drops anything that is not a named entry", () => {
    expect(sanitizeSongbookViews(null)).toEqual([])
    expect(sanitizeSongbookViews({})).toEqual([])
    expect(sanitizeSongbookViews(["x", 7, null, []])).toEqual([])
    expect(sanitizeSongbookViews([{ id: "v1" }, { name: "   " }, { name: "No id", filters: {}, sort: "tempo" }])).toEqual([
      view("v1", "No id", { sort: "tempo" }),
    ])
  })

  it("renumbers a repeated id, since deleting one of two would be ambiguous", () => {
    const views = sanitizeSongbookViews([
      { id: "v1", name: "One", filters: {}, sort: "title" },
      { id: "v1", name: "Two", filters: {}, sort: "title" },
    ])
    expect(views.map((entry) => entry.id)).toEqual(["v1", "v2"])
    expect(views.map((entry) => entry.name)).toEqual(["One", "Two"])
  })

  it("caps the list, so a corrupted cache cannot grow without limit", () => {
    const many = Array.from({ length: MAX_SONGBOOK_VIEWS + 5 }, (_, index) => ({
      id: `v${index}`,
      name: `View ${index}`,
      filters: {},
      sort: "title",
    }))
    expect(sanitizeSongbookViews(many)).toHaveLength(MAX_SONGBOOK_VIEWS)
  })

  it("numbers the next view after the ones already saved, reusing a gap", () => {
    expect(nextSongbookViewId([])).toBe("v1")
    expect(nextSongbookViewId([view("v1", "a")])).toBe("v2")
    expect(nextSongbookViewId([view("v1", "a"), view("v3", "b")])).toBe("v2")
  })

  it("updates a view when the name matches instead of adding a near-duplicate", () => {
    const saved = upsertSongbookView(
      [view("v1", "Sunday"), view("v2", "Other", { sort: "artist" })],
      view("v9", "  sunday ", { filters: { ...EMPTY_FILTERS, artist: "Radiohead" }, sort: "tempo" }),
    )
    expect(saved).toHaveLength(2)
    // Same id, same position: re-saving is how a view is edited.
    expect(saved[0]?.id).toBe("v1")
    // The name you just typed is the name it keeps, trimmed.
    expect(saved[0]?.name).toBe("sunday")
    expect(saved[0]?.filters.artist).toBe("Radiohead")
    expect(saved[0]?.sort).toBe("tempo")
    expect(saved[1]?.id).toBe("v2")
  })

  it("appends a new name and drops the oldest once the cap is reached", () => {
    let saved: SongbookView[] = []
    for (let n = 1; n <= MAX_SONGBOOK_VIEWS; n += 1) {
      saved = upsertSongbookView(saved, view(nextSongbookViewId(saved), `View ${n}`))
    }
    expect(saved).toHaveLength(MAX_SONGBOOK_VIEWS)

    const overflow = upsertSongbookView(saved, view("vX", "One more", { sort: "artist" }))
    expect(overflow).toHaveLength(MAX_SONGBOOK_VIEWS)
    expect(overflow[0]?.name).toBe("View 2")
    expect(overflow[overflow.length - 1]?.name).toBe("One more")
  })

  it("removes one view and leaves the rest in order", () => {
    const saved = [view("v1", "a"), view("v2", "b"), view("v3", "c")]
    expect(removeSongbookView(saved, "v2").map((entry) => entry.id)).toEqual(["v1", "v3"])
    // An unknown id is a no-op, never a wipe.
    expect(removeSongbookView(saved, "nope")).toHaveLength(3)
  })
})
