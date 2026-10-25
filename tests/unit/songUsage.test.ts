import { describe, expect, it } from "vitest"

import type { Performance, TimestampLike } from "@/interfaces"
import type { Setlist, SetlistSong } from "@/interfaces/setlist"
import { buildSongUsage, rotationSuggestions, usagePassIds } from "@/libs/songUsage"

const TIMESTAMP: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const entry = (songId: string, order = 0): SetlistSong => ({
  songId,
  title: songId.toUpperCase(),
  artist: "",
  key: "C",
  order,
  note: "",
  lineup: {},
})

const setlist = (id: string, songs: SetlistSong[]): Setlist => ({
  id,
  organizationId: "org-1",
  name: id,
  description: "",
  date: null,
  notes: "",
  songs,
  blocks: [],
  estimatedDurationSec: 0,
  targetMinutes: 0,
  breakMinutes: 0,
  template: false,
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
})

const performance = (overrides: Partial<Performance> = {}): Performance => ({
  id: "show-1",
  organizationId: "org-1",
  name: "Sala Sur",
  date: "2026-10-13",
  endDate: null,
  startTime: "20:00",
  endTime: "22:30",
  venue: { name: "Sala Sur", address: "Calle 1", notes: "" },
  notes: "",
  setlists: [],
  status: "scheduled",
  type: "gig",
  showLog: [],
  attendance: {},
  liveShare: null,
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

/** Shorthand for a completed event attached to the given setlist ids. */
const completed = (id: string, date: string, setlistIds: string[], endDate?: string): Performance =>
  performance({
    id,
    date,
    endDate: endDate ?? null,
    status: "completed",
    setlists: setlistIds.map((listId) => ({ id: listId, name: listId })),
  })

describe("buildSongUsage", () => {
  it("derives nothing while no event has been completed", () => {
    const lists = [setlist("l1", [entry("a")])]
    expect(
      buildSongUsage(
        [
          performance({ id: "future", status: "scheduled", setlists: [{ id: "l1", name: "l1" }] }),
          performance({ id: "dead", status: "cancelled", setlists: [{ id: "l1", name: "l1" }] }),
        ],
        lists,
      ).size,
    ).toBe(0)
  })

  it("counts only completed events: a scheduled gig is a promise, a cancelled one never happened", () => {
    const lists = [setlist("l1", [entry("a")])]
    const usage = buildSongUsage(
      [
        performance({ id: "live", date: "2026-09-01", status: "completed", setlists: [{ id: "l1", name: "l1" }] }),
        performance({ id: "booked", date: "2026-10-20", status: "scheduled", setlists: [{ id: "l1", name: "l1" }] }),
        performance({ id: "dead", date: "2026-08-15", status: "cancelled", setlists: [{ id: "l1", name: "l1" }] }),
      ],
      lists,
    )
    expect(usage.get("a")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-09-01", eventsAgo: 0 })
  })

  it("counts a completed rehearsal too — practice is a play (#46)", () => {
    const lists = [setlist("l1", [entry("a")])]
    const usage = buildSongUsage(
      [
        performance({
          id: "rehearsal",
          date: "2026-10-01",
          status: "completed",
          type: "rehearsal",
          setlists: [{ id: "l1", name: "l1" }],
        }),
      ],
      lists,
    )
    expect(usage.get("a")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-10-01", eventsAgo: 0 })
  })

  it("counts a song once per event, even across two of its lists", () => {
    const lists = [setlist("l1", [entry("a")]), setlist("l2", [entry("a", 0), entry("b", 1), entry("a", 2)])]
    const usage = buildSongUsage([completed("show-1", "2026-09-10", ["l1", "l2"])], lists)
    expect(usage.get("a")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-09-10", eventsAgo: 0 })
    expect(usage.get("b")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-09-10", eventsAgo: 0 })
  })

  it("skips a song the show log marked skipped: it was not played (#45)", () => {
    const lists = [setlist("l1", [entry("a"), entry("b")])]
    const usage = buildSongUsage(
      [
        performance({
          id: "show-1",
          date: "2026-10-01",
          status: "completed",
          setlists: [{ id: "l1", name: "l1" }],
          showLog: [
            { songId: "a", outcome: "played", actualSec: 200, note: "", updatedAt: 1 },
            { songId: "b", outcome: "skipped", actualSec: 5, note: "no time", updatedAt: 1 },
          ],
        }),
      ],
      lists,
    )
    expect(usage.get("a")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-10-01", eventsAgo: 0 })
    // The skipped song has no entry at all — it reads as "never played".
    expect(usage.has("b")).toBe(false)
  })

  it("falls back to a skipped song's older plays (#45)", () => {
    const lists = [setlist("l1", [entry("x")])]
    const usage = buildSongUsage(
      [
        performance({
          id: "show-2",
          date: "2026-10-01",
          status: "completed",
          setlists: [{ id: "l1", name: "l1" }],
          showLog: [{ songId: "x", outcome: "skipped", actualSec: 0, note: "", updatedAt: 1 }],
        }),
        completed("show-1", "2026-09-01", ["l1"]),
      ],
      lists,
    )
    expect(usage.get("x")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-09-01", eventsAgo: 1 })
  })

  it("counts an improvised song as played (#45)", () => {
    const lists = [setlist("l1", [entry("a")])]
    const usage = buildSongUsage(
      [
        performance({
          id: "show-1",
          date: "2026-10-01",
          status: "completed",
          setlists: [{ id: "l1", name: "l1" }],
          showLog: [{ songId: "a", outcome: "improvised", actualSec: 300, note: "", updatedAt: 1 }],
        }),
      ],
      lists,
    )
    expect(usage.get("a")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-10-01", eventsAgo: 0 })
  })

  it("walks newest first: the first sighting carries the last play and the distance", () => {
    const lists = [
      setlist("old", [entry("x"), entry("z")]),
      setlist("mid", [entry("y")]),
      setlist("new", [entry("x")]),
    ]
    const usage = buildSongUsage(
      [
        completed("show-1", "2026-01-10", ["old"]),
        completed("show-2", "2026-03-05", ["mid"]),
        completed("show-3", "2026-04-01", ["new"]),
      ],
      lists,
    )
    expect(usage.get("x")).toEqual({ timesPlayed: 2, lastPlayedOn: "2026-04-01", eventsAgo: 0 })
    expect(usage.get("y")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-03-05", eventsAgo: 1 })
    expect(usage.get("z")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-01-10", eventsAgo: 2 })
  })

  it("counts a later event without setlists as an event that happened", () => {
    const lists = [setlist("l1", [entry("x")])]
    const usage = buildSongUsage(
      [completed("silent", "2026-05-01", []), completed("played", "2026-04-01", ["l1"])],
      lists,
    )
    expect(usage.get("x")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-04-01", eventsAgo: 1 })
  })

  it("orders a multi-day run by its last day but records the day it was played", () => {
    const lists = [setlist("run", [entry("x")]), setlist("single", [entry("x")])]
    const usage = buildSongUsage(
      [
        // The run finishes on the 3rd, so it is the newest event even though it
        // started a day before the single-night show.
        completed("run", "2026-04-01", ["run"], "2026-04-03"),
        completed("single", "2026-04-02", ["single"]),
      ],
      lists,
    )
    expect(usage.get("x")).toEqual({ timesPlayed: 2, lastPlayedOn: "2026-04-01", eventsAgo: 0 })
  })

  it("ignores a reference to a setlist that no longer exists", () => {
    const usage = buildSongUsage([completed("show-1", "2026-09-01", ["gone"])], [])
    expect(usage.size).toBe(0)
  })

  it("breaks a same-day tie by id, so the numbers are the same on every device", () => {
    const lists = [setlist("l1", [entry("x")])]
    const usage = buildSongUsage(
      [completed("show-b", "2026-06-01", ["l1"]), completed("show-a", "2026-06-01", [])],
      lists,
    )
    // `show-a` sorts first among equal dates, so `show-b` reads as one event ago.
    expect(usage.get("x")).toEqual({ timesPlayed: 1, lastPlayedOn: "2026-06-01", eventsAgo: 1 })
  })
})

describe("usagePassIds", () => {
  const TODAY = "2026-10-15"
  const songs = [{ id: "fresh" }, { id: "stale" }, { id: "boundary" }, { id: "edge" }, { id: "never1" }, { id: "never2" }]
  const usage = new Map([
    ["fresh", { timesPlayed: 1, lastPlayedOn: "2026-05-01", eventsAgo: 0 }],
    ["stale", { timesPlayed: 3, lastPlayedOn: "2026-04-15", eventsAgo: 2 }],
    ["boundary", { timesPlayed: 1, lastPlayedOn: "2026-04-18", eventsAgo: 0 }],
    ["edge", { timesPlayed: 1, lastPlayedOn: "2026-04-17", eventsAgo: 0 }],
  ])

  it("keeps every song that has never been played, and only those", () => {
    expect(usagePassIds(songs, "never", usage, TODAY)).toEqual(new Set(["never1", "never2"]))
    // No completed events at all still means "nothing was ever played".
    expect(usagePassIds(songs, "never", new Map(), TODAY)).toEqual(
      new Set(["fresh", "stale", "boundary", "edge", "never1", "never2"]),
    )
  })

  it("keeps played songs beyond the window and leaves never-played ones to the never chip", () => {
    // 183 days ago is stale, 167 days ago is recent, and a song that has never
    // been played does not sneak in here just because it is never played.
    expect(usagePassIds(songs, "notRecent", usage, TODAY)).toEqual(new Set(["stale", "edge"]))
    expect(usagePassIds(songs, "notRecent", new Map(), TODAY)).toEqual(new Set())
  })

  it("counts the boundary itself as recent: exactly 180 days is still recent", () => {
    // `boundary` = 180 days before TODAY (kept), `edge` = 181 (stale).
    const passed = usagePassIds(songs, "notRecent", usage, TODAY)
    expect(passed.has("boundary")).toBe(false)
    expect(passed.has("edge")).toBe(true)
  })
})

describe("rotationSuggestions", () => {
  const songs = [
    { id: "current", title: "Current hit" },
    { id: "missed2", title: "Missed two" },
    { id: "missed3", title: "Missed three" },
    { id: "missed5", title: "Missed five" },
    { id: "neverA", title: "Never A" },
    { id: "neverB", title: "Never B" },
    { id: "battlehorse", title: "Battlehorse" },
  ]
  const usage = new Map([
    ["current", { timesPlayed: 4, lastPlayedOn: "2026-10-01", eventsAgo: 0 }],
    ["missed2", { timesPlayed: 2, lastPlayedOn: "2026-08-01", eventsAgo: 2 }],
    ["missed3", { timesPlayed: 6, lastPlayedOn: "2026-06-01", eventsAgo: 3 }],
    ["missed5", { timesPlayed: 1, lastPlayedOn: "2026-02-01", eventsAgo: 5 }],
    ["battlehorse", { timesPlayed: 6, lastPlayedOn: "2026-06-01", eventsAgo: 3 }],
  ])

  it("offers the songs that missed three or more events, most neglected first", () => {
    const ranked = rotationSuggestions(songs, usage)
    // `missed5` is the most neglected; `battlehorse` wins the tie against
    // `missed3` (same distance, same plays) on the title.
    expect(ranked.map(({ song }) => song.id)).toEqual([
      "missed5",
      "battlehorse",
      "missed3",
    ])
  })

  it("keeps a song that played recently out of the rotation", () => {
    // 0 and 2 events ago are still "in rotation"; the boundary (3) is not.
    const ids = rotationSuggestions(songs, usage, { limit: 99 }).map(({ song }) => song.id)
    expect(ids).not.toContain("current")
    expect(ids).not.toContain("missed2")
    expect(ids).toContain("missed3")
  })

  it("breaks a tie by fewer plays, then title, then id — never by insertion order", () => {
    // `missed3` and `battlehorse` both missed 3 events with 6 plays each:
    // the title decides, and the input order is deliberately against it.
    const reversed = [...songs].reverse()
    expect(rotationSuggestions(reversed, usage).map(({ song }) => song.id)).toEqual(
      rotationSuggestions(songs, usage).map(({ song }) => song.id),
    )
  })

  it("suggests never-played songs last, labelled as such", () => {
    const ranked = rotationSuggestions(songs, usage, { limit: 99 })
    expect(ranked.map(({ song }) => song.id)).toEqual([
      "missed5",
      "battlehorse",
      "missed3",
      "neverA",
      "neverB",
    ])
    expect(ranked.find(({ song }) => song.id === "neverA")?.eventsAgo).toBeNull()
    expect(ranked.find(({ song }) => song.id === "missed5")?.eventsAgo).toBe(5)
  })

  it("respects the limit and degrades gracefully", () => {
    expect(rotationSuggestions(songs, usage, { limit: 2 })).toHaveLength(2)
    expect(rotationSuggestions(songs, usage, { limit: 0 })).toEqual([])
    // A band that has never completed a gig has only never-played candidates,
    // which fall through to the title order.
    expect(rotationSuggestions(songs, new Map()).map(({ song }) => song.id)).toEqual([
      "battlehorse",
      "current",
      "missed5",
    ])
  })
})
