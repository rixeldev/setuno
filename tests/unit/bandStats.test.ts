import { describe, expect, it } from "vitest"

import type { OrganizationMember, Performance, Song, TimestampLike } from "@/interfaces"
import type { Setlist, SetlistSong } from "@/interfaces/setlist"
import { EMPTY_SONG_LINKS } from "@/interfaces/song"
import {
  buildBandStats,
  buildYearRecap,
  defaultRecapYear,
  recapFileName,
  recapYears,
} from "@/libs/bandStats"

/** Local-time stamp so the year never depends on the runner's timezone. */
const stampAt = (year: number, month: number, day: number): TimestampLike => {
  const date = new Date(year, month - 1, day)
  return { seconds: date.getTime() / 1000, nanoseconds: 0, toDate: () => date }
}

const entry = (songId: string, order = 0): SetlistSong => ({
  songId,
  title: songId.toUpperCase(),
  artist: "",
  key: "C",
  order,
  note: "",
})

const list = (id: string, songIds: string[], overrides: Partial<Setlist> = {}): Setlist => ({
  id,
  organizationId: "org-1",
  name: id,
  description: "",
  date: null,
  notes: "",
  songs: songIds.map(entry),
  blocks: [],
  estimatedDurationSec: 0,
  targetMinutes: 0,
  breakMinutes: 0,
  template: false,
  createdBy: "uid-1",
  createdAt: stampAt(2026, 1, 1),
  updatedAt: stampAt(2026, 1, 1),
  ...overrides,
})

const show = (overrides: Partial<Performance> = {}): Performance => ({
  id: "show-1",
  organizationId: "org-1",
  name: "Sala Sur",
  date: "2026-05-01",
  endDate: null,
  startTime: "20:00",
  endTime: "22:30",
  venue: { name: "Sala Sur", address: "Calle 1", notes: "" },
  notes: "",
  setlists: [],
  status: "completed",
  type: "gig",
  showLog: [],
  attendance: {},
  liveShare: null,
  createdBy: "uid-1",
  createdAt: stampAt(2026, 1, 1),
  updatedAt: stampAt(2026, 1, 1),
  ...overrides,
})

/** Shorthand for an event attached to the given setlist ids. */
const attached = (
  id: string,
  date: string,
  setlistIds: string[],
  overrides: Partial<Performance> = {},
): Performance =>
  show({
    id,
    date,
    setlists: setlistIds.map((listId) => ({ id: listId, name: listId })),
    ...overrides,
  })

const song = (id: string, overrides: Partial<Song> = {}): Song => ({
  id,
  organizationId: "org-1",
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
  status: "active",
  deletedAt: null,
  deletedBy: null,
  createdBy: "uid-1",
  createdByName: "Ada",
  createdAt: stampAt(2026, 2, 10),
  updatedAt: stampAt(2026, 2, 10),
  ...overrides,
})

const member = (uid: string, displayName: string): OrganizationMember => ({
  uid,
  displayName,
  email: `${uid}@band.test`,
  photoURL: null,
  role: "member",
  joinedAt: stampAt(2026, 1, 1),
  invitedBy: null,
})

describe("buildBandStats", () => {
  it("ranks played songs by plays, leaves the never-played out and counts shows", () => {
    const lists = [list("l1", ["a"]), list("l2", ["a", "b"])]
    const stats = buildBandStats(
      [
        attached("s1", "2026-03-01", ["l1"]),
        attached("s2", "2026-04-01", ["l2"]),
        show({ id: "booked", status: "scheduled", setlists: [{ id: "l1", name: "l1" }] }),
        show({ id: "dead", status: "cancelled", setlists: [{ id: "l1", name: "l1" }] }),
      ],
      lists,
      [song("a", { title: "Alpha" }), song("b", { title: "Beta" }), song("c", { title: "Gamma" })],
      [member("uid-1", "Ada")],
    )
    expect(stats.showsPlayed).toBe(2)
    expect(stats.songsPlayed).toBe(2)
    expect(stats.topSongs.map((top) => [top.id, top.timesPlayed])).toEqual([
      ["a", 2],
      ["b", 1],
    ])
  })

  it("counts a song once per event even when two of its lists played it", () => {
    const stats = buildBandStats(
      [attached("s1", "2026-03-01", ["l1", "l2"])],
      [list("l1", ["a"]), list("l2", ["a", "b"])],
      [song("a"), song("b")],
      [],
    )
    expect(stats.topSongs.find((top) => top.id === "a")?.timesPlayed).toBe(1)
    expect(stats.songsPlayed).toBe(2)
  })

  it("keeps a played song out of the ranking once it left the library", () => {
    // Trashed songs never reach `songs`, but they still happened: the distinct
    // count tells the truth while the ranking shows only what can be opened.
    const stats = buildBandStats(
      [attached("s1", "2026-03-01", ["l1"])],
      [list("l1", ["gone"])],
      [],
      [],
    )
    expect(stats.songsPlayed).toBe(1)
    expect(stats.topSongs).toEqual([])
  })

  it("averages measurable lists only — not templates, not empty, not unknown", () => {
    const stats = buildBandStats(
      [],
      [
        list("real1", ["a"], { estimatedDurationSec: 600 }),
        list("real2", ["b"], { estimatedDurationSec: 600 }),
        list("draft", [], { estimatedDurationSec: 9_999 }),
        list("nodurations", ["a"], { estimatedDurationSec: 0 }),
        list("template", ["a"], { estimatedDurationSec: 9_999, template: true }),
      ],
      [song("a"), song("b"), song("c")],
      [],
    )
    expect(stats.averageSetMinutes).toBe(10)
    expect(stats.setlistsAveraged).toBe(2)
  })

  it("reads an unmeasurable library as no average rather than zero", () => {
    const stats = buildBandStats([], [list("l1", ["a"])], [song("a")], [])
    expect(stats.averageSetMinutes).toBeNull()
    expect(stats.setlistsAveraged).toBe(0)
  })

  it("adds each setlist's minutes once per show and rounds to whole minutes", () => {
    const stats = buildBandStats(
      [
        attached("s1", "2026-03-01", ["l1", "l1"]), // the same list attached twice: played once
        attached("s2", "2026-04-01", ["l1"]), // ...but the next show is another play
        attached("s3", "2026-04-02", ["tiny"]), // 90 seconds -> 2 minutes
        show({ id: "booked", status: "scheduled", setlists: [{ id: "l1", name: "l1" }] }),
      ],
      [list("l1", ["a"], { estimatedDurationSec: 600 }), list("tiny", ["b"], { estimatedDurationSec: 90 })],
      [song("a"), song("b")],
      [],
    )
    expect(stats.musicMinutes).toBe(22)
  })

  it("counts what each member authored and orders by contribution", () => {
    const stats = buildBandStats(
      [
        show({ id: "e1", createdBy: "ghost" }),
        show({ id: "e2", createdBy: "bob" }),
      ],
      [list("l1", ["a"], { createdBy: "bob" })],
      [
        song("a", { createdBy: "ada" }),
        song("b", { createdBy: "ada" }),
        song("c", { createdBy: "ada" }),
      ],
      [member("ada", "Ada"), member("bob", "Bob"), member("cal", "Cal")],
    )
    expect(
      stats.memberActivity.map((activity) => [
        activity.uid,
        activity.songs,
        activity.setlists,
        activity.events,
        activity.total,
      ]),
    ).toEqual([
      ["ada", 3, 0, 0, 3],
      ["bob", 0, 1, 1, 2],
      ["cal", 0, 0, 0, 0],
    ])
    // "ghost" authored an event but is no longer in the band: no row for them.
    expect(stats.memberActivity.some((activity) => activity.uid === "ghost")).toBe(false)
  })

  it("never counts a rehearsal as a show, but keeps its songs played (#46)", () => {
    const lists = [list("l1", ["a"], { estimatedDurationSec: 600 })]
    const stats = buildBandStats(
      [
        attached("gig", "2026-03-01", ["l1"]),
        attached("run", "2026-03-15", ["l1"], { type: "rehearsal" }),
      ],
      lists,
      [song("a")],
      [],
    )
    // The gig is the show; the rehearsal still ran the list, so the song's
    // play count — the number the reader footer and the usage filter quote —
    // counts both.
    expect(stats.showsPlayed).toBe(1)
    expect(stats.musicMinutes).toBe(10)
    expect(stats.songsPlayed).toBe(1)
    expect(stats.topSongs.find((top) => top.id === "a")?.timesPlayed).toBe(2)
  })
})

describe("buildYearRecap", () => {
  it("recaps only completed shows that started in that year", () => {
    const recap = buildYearRecap(
      [
        attached("live", "2026-06-01", ["l1"]),
        attached("booked", "2026-07-01", ["l1"], { status: "scheduled" }),
        attached("dead", "2026-08-01", ["l1"], { status: "cancelled" }),
        attached("last-year", "2025-06-01", ["l1"]),
      ],
      [list("l1", ["a"])],
      [song("a")],
      2026,
    )
    expect(recap.shows).toBe(1)
    expect(recap.songsPlayed).toBe(1)
    expect(recap.topSong).toEqual({
      id: "a",
      title: "a",
      artist: "",
      timesPlayed: 1,
    })
  })

  it("attributes a run to the year it started in", () => {
    const run = attached("run", "2025-12-31", ["l1"])
    run.endDate = "2026-01-01"
    expect(buildYearRecap([run], [list("l1", ["a"])], [song("a")], 2025).shows).toBe(1)
    expect(buildYearRecap([run], [list("l1", ["a"])], [song("a")], 2026).shows).toBe(0)
  })

  it("recaps gigs only — a completed rehearsal is not a show (#46)", () => {
    const lists = [list("l1", ["a"], { estimatedDurationSec: 600 })]
    const recap = buildYearRecap(
      [
        attached("gig", "2026-06-01", ["l1"]),
        attached("run", "2026-06-15", ["l1"], { type: "rehearsal" }),
      ],
      lists,
      [song("a")],
      2026,
    )
    // The card tells the story of the stage: one show, one sighting, ten
    // minutes — the practice room never reaches the recap.
    expect(recap.shows).toBe(1)
    expect(recap.songsPlayed).toBe(1)
    expect(recap.minutes).toBe(10)
  })

  it("counts one play per song per night and sums both lists' minutes", () => {
    const recap = buildYearRecap(
      [attached("s1", "2026-06-01", ["l1", "l2"])],
      [list("l1", ["a", "b"]), list("l2", ["a"], { estimatedDurationSec: 90 })],
      [song("a"), song("b")],
      2026,
    )
    expect(recap.songsPlayed).toBe(2)
    // l1 has no stored duration, l2 contributes its 90 seconds -> 2 minutes.
    expect(recap.minutes).toBe(2)
  })

  it("drops a skipped song from the sightings but keeps the list's minutes (#45)", () => {
    const recap = buildYearRecap(
      [
        attached("s1", "2026-06-01", ["l1"], {
          showLog: [{ songId: "b", outcome: "skipped", actualSec: 0, note: "", updatedAt: 1 }],
        }),
      ],
      [list("l1", ["a", "b"], { estimatedDurationSec: 600 })],
      [song("a"), song("b")],
      2026,
    )
    // b was in the list but the band cut it: one sighting, one song — while
    // the recap minute stays the programmed estimate, because the measured
    // clock (banter included) lives in the post-gig report, not in the year.
    expect(recap.songsPlayed).toBe(1)
    expect(recap.minutes).toBe(10)
    expect(recap.topSong?.id).toBe("a")
  })

  it("picks the most played song, breaking a tie by title, and stays null when idle", () => {
    const lists = [
      list("s1", ["beta"], { estimatedDurationSec: 600 }),
      list("s2", ["alpha"]),
      list("s3", ["beta"]),
    ]
    const recap = buildYearRecap(
      [attached("s1", "2026-06-01", ["s1"]), attached("s2", "2026-07-01", ["s2"]), attached("s3", "2026-08-01", ["s3"])],
      lists,
      [song("alpha", { title: "Alpha" }), song("beta", { title: "Beta" })],
      2026,
    )
    expect(recap.topSong?.id).toBe("beta")

    const idle = buildYearRecap([], [], [], 2026)
    expect(idle.topSong).toBeNull()
    expect(idle).toEqual({
      year: 2026,
      shows: 0,
      songsPlayed: 0,
      minutes: 0,
      newSongs: 0,
      topSong: null,
    })
  })

  it("counts songs created in the year and skips a stamp that never resolved", () => {
    const recap = buildYearRecap(
      [],
      [],
      [
        song("new", { createdAt: stampAt(2026, 3, 1) }),
        song("old", { createdAt: stampAt(2024, 3, 1) }),
        song("pending", { createdAt: undefined as unknown as TimestampLike }),
      ],
      2026,
    )
    expect(recap.newSongs).toBe(1)
  })
})

describe("recapYears", () => {
  it("offers every event year, every song year and the current one, newest first", () => {
    const years = recapYears(
      [show({ id: "old", date: "2024-05-01" }), show({ id: "future", date: "2027-05-01" })],
      [song("a", { createdAt: stampAt(2025, 1, 1) })],
      new Date(2026, 5, 1),
    )
    expect(years).toEqual([2027, 2026, 2025, 2024])
  })
})

describe("defaultRecapYear", () => {
  it("falls back to the current year while the band has nothing yet", () => {
    expect(defaultRecapYear([], [], [], new Date(2026, 5, 1))).toBe(2026)
  })

  it("opens on the latest year with content, skipping a future booking", () => {
    const years = defaultRecapYear(
      [
        attached("played", "2024-05-01", ["l1"]),
        show({ id: "booked", date: "2027-05-01", status: "scheduled" }),
      ],
      [list("l1", ["a"])],
      [song("a", { createdAt: stampAt(2024, 1, 1) })],
      new Date(2026, 5, 1),
    )
    expect(years).toBe(2024)
  })

  it("prefers the current year when it holds something", () => {
    const year = defaultRecapYear(
      [attached("new", "2026-05-01", ["l1"]), attached("old", "2025-05-01", ["l1"])],
      [list("l1", ["a"])],
      [song("a")],
      new Date(2026, 5, 1),
    )
    expect(year).toBe(2026)
  })
})

describe("recapFileName", () => {
  it("slugs the band name, stripping accents and punctuation", () => {
    expect(recapFileName("Ñandú Groove!", 2026)).toBe("setuno-nandu-groove-2026.png")
    expect(recapFileName("  The   Band  ", 2025)).toBe("setuno-the-band-2025.png")
  })

  it("falls back to a valid name when the band has none", () => {
    expect(recapFileName("", 2026)).toBe("setuno-band-2026.png")
    expect(recapFileName("!!!", 2026)).toBe("setuno-band-2026.png")
  })
})
