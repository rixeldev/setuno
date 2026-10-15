import { describe, expect, it } from "vitest"

import type { Performance } from "@/interfaces/performance"
import type { TimestampLike } from "@/interfaces/timestamp"
import {
  DEFAULT_EVENT_TYPES,
  EVENT_TYPES,
  filterByEventType,
  isGig,
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
