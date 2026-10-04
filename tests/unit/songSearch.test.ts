import { describe, expect, it } from "vitest"

import type { Song } from "@/interfaces/song"
import type { TimestampLike } from "@/interfaces/timestamp"
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterSongs,
  hasFacetFilters,
  isFiltered,
  songFacets,
} from "@/libs/songSearch"

const timestamp: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const song = (overrides: Partial<Song> & Pick<Song, "id" | "title">): Song => ({
  id: overrides.id,
  organizationId: "org",
  title: overrides.title,
  artist: overrides.artist ?? "",
  key: overrides.key ?? "",
  originalKey: overrides.key ?? "C",
  capo: 0,
  bpm: null,
  durationSec: null,
  genre: overrides.genre ?? "",
  notes: "",
  tags: overrides.tags ?? [],
  sections: [],
  createdBy: "uid",
  createdByName: "Admin",
  createdAt: timestamp,
  updatedAt: timestamp,
})

const library: Song[] = [
  song({ id: "1", title: "Wonderwall", artist: "Oasis", key: "C", genre: "Rock", tags: ["stadium"] }),
  song({ id: "2", title: "Hallelujah", artist: "Leonard Cohen", key: "F", genre: "Folk", tags: ["ballad", "stadium"] }),
  song({ id: "3", title: "Blackbird", artist: "The Beatles", key: "G", genre: "Rock", tags: ["acoustic"] }),
  song({ id: "4", title: "No Tag", artist: "", key: "", genre: "", tags: [] }),
]

describe("filter predicates", () => {
  it("knows when nothing is filtered", () => {
    expect(isFiltered(EMPTY_FILTERS)).toBe(false)
    expect(hasFacetFilters(EMPTY_FILTERS)).toBe(false)
  })

  it("counts active facets but not the search box", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0)
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: "wonder" })).toBe(0)
    expect(countActiveFilters({ ...EMPTY_FILTERS, artist: "Oasis", key: "C" })).toBe(2)
    expect(isFiltered({ ...EMPTY_FILTERS, search: "  " })).toBe(false)
  })
})

describe("filterSongs", () => {
  it("returns everything when nothing is filtered", () => {
    expect(filterSongs(library, EMPTY_FILTERS)).toHaveLength(4)
  })

  it("searches the title, ignoring case", () => {
    expect(filterSongs(library, { ...EMPTY_FILTERS, search: "wonder" }).map((s) => s.id)).toEqual(["1"])
    expect(filterSongs(library, { ...EMPTY_FILTERS, search: "BLACKBIRD" }).map((s) => s.id)).toEqual(["3"])
  })

  it("searches the artist, genre, key and tags too", () => {
    expect(filterSongs(library, { ...EMPTY_FILTERS, search: "oasis" }).map((s) => s.id)).toEqual(["1"])
    expect(filterSongs(library, { ...EMPTY_FILTERS, search: "folk" }).map((s) => s.id)).toEqual(["2"])
    expect(filterSongs(library, { ...EMPTY_FILTERS, search: "acoustic" }).map((s) => s.id)).toEqual(["3"])
  })

  it("requires every word of a multi-word search to match", () => {
    expect(filterSongs(library, { ...EMPTY_FILTERS, search: "black wings" })).toEqual([])
    expect(filterSongs(library, { ...EMPTY_FILTERS, search: "beatles rock" }).map((s) => s.id)).toEqual(["3"])
  })

  it("applies facets as exact matches", () => {
    expect(filterSongs(library, { ...EMPTY_FILTERS, genre: "Rock" }).map((s) => s.id)).toEqual(["1", "3"])
    expect(filterSongs(library, { ...EMPTY_FILTERS, key: "F" }).map((s) => s.id)).toEqual(["2"])
  })

  it("combines the search term with facets", () => {
    expect(
      filterSongs(library, { ...EMPTY_FILTERS, genre: "Rock", search: "blackbird" }).map((s) => s.id),
    ).toEqual(["3"])
  })

  it("can legitimately return nothing", () => {
    expect(filterSongs(library, { ...EMPTY_FILTERS, search: "nirvana" })).toEqual([])
    expect(filterSongs(library, { ...EMPTY_FILTERS, tag: "nothing-here" })).toEqual([])
  })
})

describe("songFacets", () => {
  it("lists the distinct values available in the library, sorted", () => {
    expect(songFacets(library)).toEqual({
      artists: ["Leonard Cohen", "Oasis", "The Beatles"],
      genres: ["Folk", "Rock"],
      keys: ["C", "F", "G"],
      tags: ["acoustic", "ballad", "stadium"],
    })
  })

  it("skips blank values so empty chips are never offered", () => {
    const facets = songFacets([song({ id: "9", title: "Untitled" })])
    expect(facets).toEqual({ artists: [], genres: [], keys: [], tags: [] })
  })

  it("copes with an empty songbook", () => {
    expect(songFacets([])).toEqual({ artists: [], genres: [], keys: [], tags: [] })
  })
})