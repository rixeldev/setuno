import { describe, expect, it } from "vitest"

import { EMPTY_SONG_LINKS, type LyricLine, type Song, type SongSection } from "@/interfaces/song"
import type { TimestampLike } from "@/interfaces/timestamp"
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterSongs,
  findDuplicateSongs,
  hasFacetFilters,
  isFiltered,
  normalizeSongText,
  progressionTokens,
  songChordLines,
  songDurationSec,
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
  links: EMPTY_SONG_LINKS,
  status: overrides.status ?? "active",
  deletedAt: null,
  deletedBy: null,
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

/** One lyric line whose chords sit four characters apart, left to right. */
const chordLine = (chords: string[]): LyricLine => ({
  text: chords.length > 0 ? "la la la" : "",
  chords: chords.map((chord, position) => ({ chord, position: position * 4 })),
})

/** A chord-only song: every entry is one line holding that progression. */
const withChordLines = (base: Song, lines: string[][]): Song => ({
  ...base,
  sections: lines.map(
    (chords, index): SongSection => ({
      id: `chords-${index}`,
      type: "instrumental",
      label: `Riff ${index + 1}`,
      lines: [chordLine(chords)],
    }),
  ),
})

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

describe("filterSongs — favorites only (roadmap #33)", () => {
  const favorites = new Set(["1", "3"])

  it("keeps only the starred songs", () => {
    expect(
      filterSongs(library, { ...EMPTY_FILTERS, favoritesOnly: true }, favorites).map((s) => s.id),
    ).toEqual(["1", "3"])
  })

  it("returns nothing when no set is given instead of everything", () => {
    expect(filterSongs(library, { ...EMPTY_FILTERS, favoritesOnly: true })).toEqual([])
    expect(filterSongs(library, { ...EMPTY_FILTERS, favoritesOnly: true }, new Set())).toEqual([])
  })

  it("stacks with the other filters and counts towards the badge", () => {
    expect(
      filterSongs(
        library,
        { ...EMPTY_FILTERS, favoritesOnly: true, tag: "acoustic" },
        favorites,
      ).map((s) => s.id),
    ).toEqual(["3"])
    expect(countActiveFilters({ ...EMPTY_FILTERS, favoritesOnly: true })).toBe(1)
    expect(isFiltered({ ...EMPTY_FILTERS, favoritesOnly: true })).toBe(true)
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

describe("normalizeSongText", () => {
  it("ignores case, padding and whitespace runs", () => {
    expect(normalizeSongText("  Wonder   Wall ")).toBe("wonder wall")
    expect(normalizeSongText("Wonder\u00a0Wall")).toBe("wonder wall")
    expect(normalizeSongText("WONDER WALL")).toBe("wonder wall")
  })
})

describe("findDuplicateSongs", () => {
  it("matches the title ignoring case and padding", () => {
    expect(findDuplicateSongs(library, { title: "  WONDERWALL " }).map((d) => d.song.id)).toEqual([
      "1",
    ])
    expect(findDuplicateSongs(library, { title: "Blackbird" }).map((s) => s.song.id)).toEqual(["3"])
  })

  it("ranks a same-artist match above a song with no artist", () => {
    const songs = [
      song({ id: "a", title: "Hallelujah" }),
      song({ id: "b", title: "Hallelujah", artist: "Leonard Cohen" }),
    ]
    const matches = findDuplicateSongs(songs, { title: "Hallelujah", artist: "Leonard Cohen" })
    expect(matches.map((match) => match.song.id)).toEqual(["b", "a"])
    expect(matches[0]?.sameArtist).toBe(true)
    expect(matches[1]?.sameArtist).toBe(false)
  })

  it("ignores another artist's version when both sides credit somebody", () => {
    expect(findDuplicateSongs(library, { title: "Wonderwall", artist: "Someone else" })).toEqual([])
  })

  it("still finds a title match when the stored song has no artist", () => {
    const songs = [song({ id: "x", title: "Yesterday" })]
    expect(findDuplicateSongs(songs, { title: "Yesterday", artist: "The Beatles" })).toHaveLength(1)
  })

  it("never matches on an empty title", () => {
    expect(findDuplicateSongs(library, { title: "   " })).toEqual([])
  })

  it("returns nothing for a unique song", () => {
    expect(findDuplicateSongs(library, { title: "Bohemian Rhapsody", artist: "Queen" })).toEqual([])
  })
})

/** Ids of a result set, so the assertions read as an ordered list. */
const ids = (songs: Song[]): string[] => songs.map((entry) => entry.id)

describe("progressionTokens", () => {
  it("reads commas, pipes and run-together spaces as one separator", () => {
    expect(progressionTokens("C G Am F")).toEqual(["c", "g", "am", "f"])
    expect(progressionTokens("c, g; Am|F")).toEqual(["c", "g", "am", "f"])
    expect(progressionTokens("  C   G  ")).toEqual(["c", "g"])
  })

  it("keeps a slash chord as a single token", () => {
    expect(progressionTokens("G/B Am")).toEqual(["g/b", "am"])
  })

  it("is empty when nothing usable was typed", () => {
    expect(progressionTokens("")).toEqual([])
    expect(progressionTokens(" , ; | ")).toEqual([])
  })
})

describe("songChordLines", () => {
  it("reads every line's chords in playing order", () => {
    const target = withChordLines(song({ id: "c", title: "Chords" }), [
      ["C", "G"],
      ["Am", "F"],
    ])
    expect(songChordLines(target)).toEqual([
      ["c", "g"],
      ["am", "f"],
    ])
  })

  it("orders a line by position, not by the order they were typed", () => {
    const target: Song = {
      ...song({ id: "c", title: "Out of order" }),
      sections: [
        {
          id: "s1",
          type: "verse",
          label: "Verse 1",
          lines: [
            {
              text: "hello world",
              chords: [
                { chord: "G", position: 6 },
                { chord: "C", position: 0 },
              ],
            },
          ],
        },
      ],
    }
    expect(songChordLines(target)).toEqual([["c", "g"]])
  })

  it("has nothing to read on a song with no sections", () => {
    expect(songChordLines(song({ id: "n", title: "No sections" }))).toEqual([])
  })
})

describe("filterSongs — chord progression", () => {
  const progLibrary: Song[] = [
    withChordLines(song({ id: "p1", title: "Four Chords" }), [
      ["C", "G", "Am", "F"],
      ["C", "G"],
    ]),
    withChordLines(song({ id: "p2", title: "Split Up" }), [
      ["C", "G"],
      ["Am", "F"],
    ]),
    withChordLines(song({ id: "p3", title: "Slash" }), [["G/B", "C"]]),
    song({ id: "p4", title: "Silent" }),
  ]

  it("matches a run of chords on a single line", () => {
    expect(ids(filterSongs(progLibrary, { ...EMPTY_FILTERS, progression: "C G Am F" }))).toEqual([
      "p1",
    ])
  })

  it("never stitches a progression together from two lines", () => {
    // `p1` plays G then Am on one line, so it matches; `p2` plays them on two
    // different lines and must stay out even though its chords all appear.
    expect(ids(filterSongs(progLibrary, { ...EMPTY_FILTERS, progression: "G Am" }))).toEqual([
      "p1",
    ])
    expect(ids(filterSongs(progLibrary, { ...EMPTY_FILTERS, progression: "C G Am F" }))).not.toContain(
      "p2",
    )
  })

  it("ignores case and keeps the slash bass", () => {
    expect(ids(filterSongs(progLibrary, { ...EMPTY_FILTERS, progression: "g/b c" }))).toEqual(["p3"])
  })

  it("leaves a song with no chords out of every progression search", () => {
    for (const progression of ["C G", "Am", "G/B"]) {
      expect(ids(filterSongs(progLibrary, { ...EMPTY_FILTERS, progression }))).not.toContain("p4")
    }
  })

  it("is counted by the badge and marks the book as filtered", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, progression: "C G" })).toBe(1)
    expect(isFiltered({ ...EMPTY_FILTERS, progression: "  " })).toBe(false)
    expect(isFiltered({ ...EMPTY_FILTERS, progression: "C G" })).toBe(true)
  })

  it("stacks with the other filters instead of replacing them", () => {
    const stackLibrary: Song[] = [
      {
        ...withChordLines(song({ id: "a", title: "Rock one", genre: "Rock" }), [["C", "G"]]),
        bpm: 120,
      },
      {
        ...withChordLines(song({ id: "b", title: "Folk one", genre: "Folk" }), [["C", "G"]]),
        bpm: 120,
      },
      {
        ...withChordLines(song({ id: "c", title: "Rock two", genre: "Rock" }), [["C", "G"]]),
        bpm: 60,
      },
    ]
    const filters = { ...EMPTY_FILTERS, genre: "Rock", bpm: "fast" as const, progression: "C G" }
    expect(ids(filterSongs(stackLibrary, filters))).toEqual(["a"])
    expect(countActiveFilters(filters)).toBe(3)
  })
})

describe("filterSongs — tempo buckets", () => {
  const tempoLibrary: Song[] = [
    { ...song({ id: "slow", title: "Slow" }), bpm: 60 },
    { ...song({ id: "slowEdge", title: "Slowest medium" }), bpm: 89 },
    { ...song({ id: "medium", title: "Medium" }), bpm: 90 },
    { ...song({ id: "mediumEdge", title: "Fastest medium" }), bpm: 119 },
    { ...song({ id: "fast", title: "Fast" }), bpm: 120 },
    { ...song({ id: "fastEdge", title: "Slowest sprint" }), bpm: 159 },
    { ...song({ id: "sprint", title: "Sprint" }), bpm: 160 },
    { ...song({ id: "unknown", title: "No tempo" }), bpm: null },
  ]

  it("bands the tempo inclusively at every boundary", () => {
    expect(ids(filterSongs(tempoLibrary, { ...EMPTY_FILTERS, bpm: "slow" }))).toEqual([
      "slow",
      "slowEdge",
    ])
    expect(ids(filterSongs(tempoLibrary, { ...EMPTY_FILTERS, bpm: "medium" }))).toEqual([
      "medium",
      "mediumEdge",
    ])
    expect(ids(filterSongs(tempoLibrary, { ...EMPTY_FILTERS, bpm: "fast" }))).toEqual([
      "fast",
      "fastEdge",
    ])
    expect(ids(filterSongs(tempoLibrary, { ...EMPTY_FILTERS, bpm: "sprint" }))).toEqual(["sprint"])
  })

  it("never matches a song whose tempo nobody set", () => {
    for (const bucket of ["slow", "medium", "fast", "sprint"] as const) {
      expect(ids(filterSongs(tempoLibrary, { ...EMPTY_FILTERS, bpm: bucket }))).not.toContain(
        "unknown",
      )
    }
  })
})

describe("songDurationSec", () => {
  it("prefers the stored duration", () => {
    expect(songDurationSec({ ...song({ id: "d", title: "Stored" }), durationSec: 240 })).toBe(240)
  })

  it("falls back to the lyric-length estimate the rows show", () => {
    const estimated: Song = {
      ...song({ id: "e", title: "Estimated" }),
      sections: [
        {
          id: "s1",
          type: "verse",
          label: "Verse 1",
          lines: [
            {
              text: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour",
              chords: [],
            },
          ],
        },
      ],
    }
    // 24 words at ~2.4 words per second.
    expect(songDurationSec(estimated)).toBe(10)
  })

  it("is null when there is nothing to measure", () => {
    expect(songDurationSec(song({ id: "n", title: "Silent" }))).toBeNull()
    expect(songDurationSec({ ...song({ id: "z", title: "Zero" }), durationSec: 0 })).toBeNull()
  })
})

describe("filterSongs — length buckets", () => {
  const lengthLibrary: Song[] = [
    { ...song({ id: "short", title: "Short" }), durationSec: 120 },
    { ...song({ id: "shortEdge", title: "Longest short" }), durationSec: 179 },
    { ...song({ id: "standard", title: "Standard" }), durationSec: 180 },
    { ...song({ id: "standardEdge", title: "Longest standard" }), durationSec: 299 },
    { ...song({ id: "long", title: "Long" }), durationSec: 300 },
    song({ id: "unknown", title: "Unmeasured" }),
  ]

  it("bands the length inclusively at every boundary", () => {
    expect(ids(filterSongs(lengthLibrary, { ...EMPTY_FILTERS, duration: "short" }))).toEqual([
      "short",
      "shortEdge",
    ])
    expect(ids(filterSongs(lengthLibrary, { ...EMPTY_FILTERS, duration: "standard" }))).toEqual([
      "standard",
      "standardEdge",
    ])
    expect(ids(filterSongs(lengthLibrary, { ...EMPTY_FILTERS, duration: "long" }))).toEqual(["long"])
  })

  it("keeps a song with nothing to measure out of every bucket", () => {
    for (const bucket of ["short", "standard", "long"] as const) {
      expect(ids(filterSongs(lengthLibrary, { ...EMPTY_FILTERS, duration: bucket }))).not.toContain(
        "unknown",
      )
    }
  })
})