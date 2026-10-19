import { describe, expect, it } from "vitest"

import type { Performance } from "@/interfaces/performance"
import type { TimestampLike } from "@/interfaces/timestamp"
import {
  DEFAULT_EVENT_TYPES,
  EVENT_TYPES,
  filterByEventType,
  isGig,
  orderPerformancesAsc,
} from "@/libs/performances"

const TIMESTAMP: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const performance = (id: string, overrides: Partial<Performance> = {}): Performance => ({
  id,
  organizationId: "org-1",
  name: id,
  date: "2026-10-13",
  endDate: null,
  startTime: "20:00",
  endTime: "22:00",
  venue: { name: "Sala Sur", address: "", notes: "" },
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

describe("filterByEventType", () => {
  const shows = [
    performance("a", { type: "gig" }),
    performance("b", { type: "rehearsal" }),
    performance("c", { type: "gig" }),
  ]

  it("keeps only the types that are switched on", () => {
    expect(filterByEventType(shows, ["rehearsal"]).map((show) => show.id)).toEqual(["b"])
    expect(filterByEventType(shows, ["gig"]).map((show) => show.id)).toEqual(["a", "c"])
  })

  it("reads an empty selection as the default, not as 'hide everything'", () => {
    // The calendar's own rule (filterByStatus), kept verbatim: tapping the
    // last active chip off must never leave a screen blank behind chips that
    // all read as off.
    expect(filterByEventType(shows, []).map((show) => show.id)).toEqual(["a", "b", "c"])
  })

  it("offers both types and defaults to both", () => {
    expect(EVENT_TYPES).toEqual(["gig", "rehearsal"])
    expect(DEFAULT_EVENT_TYPES).toEqual(["gig", "rehearsal"])
  })
})

describe("isGig", () => {
  it("reads a rehearsal as not-a-show and everything else as a gig", () => {
    expect(isGig(performance("g", { type: "gig" }))).toBe(true)
    expect(isGig(performance("r", { type: "rehearsal" }))).toBe(false)
    // Forgiving by design: an object that never went through the mapper keeps
    // counting as the show it always was.
    const missing = { ...performance("old") } as Performance
    delete (missing as Partial<Performance>).type
    expect(isGig(missing)).toBe(true)
  })
})

describe("orderPerformancesAsc", () => {
  it("sorts by date ascending regardless of the incoming order", () => {
    // The listener queries desc to window on the newest events (P0.9 / #82);
    // this is what puts soonest-first back in front of every consumer.
    const shows = [
      performance("future", { date: "2026-12-24" }),
      performance("old", { date: "2025-01-01" }),
      performance("soon", { date: "2026-10-31" }),
    ]
    expect(orderPerformancesAsc(shows).map((show) => show.id)).toEqual(["old", "soon", "future"])
  })

  it("breaks same-day ties by start time, then id — never by incoming order", () => {
    const shows = [
      performance("b", { date: "2026-10-13", startTime: "20:00" }),
      performance("a", { date: "2026-10-13", startTime: "22:00" }),
      performance("c", { date: "2026-10-13", startTime: "20:00" }),
    ]
    expect(orderPerformancesAsc(shows).map((show) => show.id)).toEqual(["b", "c", "a"])
  })

  it("returns a new array and leaves the input untouched", () => {
    const shows = [performance("z", { date: "2026-12-01" }), performance("a", { date: "2026-01-01" })]
    const ordered = orderPerformancesAsc(shows)
    expect(ordered).not.toBe(shows)
    expect(shows.map((show) => show.id)).toEqual(["z", "a"])
  })
})
