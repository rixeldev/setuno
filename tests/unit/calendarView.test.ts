import { describe, expect, it } from "vitest"

import type { Performance } from "@/interfaces/performance"
import type { TimestampLike } from "@/interfaces/timestamp"
import {
  CALENDAR_STATUSES,
  DEFAULT_STATUSES,
  dayCounts,
  filterByStatus,
  groupByDay,
  shiftWeek,
  upcomingByDay,
  weekDays,
  weekStartIso,
} from "@/libs/calendarView"

const TIMESTAMP: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const performance = (id: string, date: string, overrides: Partial<Performance> = {}): Performance => ({
  id,
  organizationId: "org-1",
  name: id,
  date,
  endDate: null,
  startTime: "20:00",
  endTime: "22:00",
  venue: { name: "Sala Sur", address: "", notes: "" },
  notes: "",
  setlists: [],
  status: "scheduled",
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

const dayOfWeek = (iso: string): number => new Date(`${iso}T12:00:00`).getDay()

describe("filterByStatus", () => {
  const shows = [
    performance("a", "2026-10-13"),
    performance("b", "2026-10-14", { status: "completed" }),
    performance("c", "2026-10-15", { status: "cancelled" }),
  ]

  it("keeps only the statuses that are switched on", () => {
    expect(filterByStatus(shows, ["scheduled", "cancelled"]).map((show) => show.id)).toEqual([
      "a",
      "c",
    ])
    expect(filterByStatus(shows, ["completed"]).map((show) => show.id)).toEqual(["b"])
  })

  it("reads an empty selection as the default, not as 'hide everything'", () => {
    // Tapping the last active chip off must not leave an empty calendar behind.
    expect(filterByStatus(shows, []).map((show) => show.id)).toEqual(["a", "b"])
    expect(filterByStatus(shows, []).map((show) => show.status)).not.toContain("cancelled")
  })

  it("offers every status and defaults to all but the cancelled", () => {
    expect(CALENDAR_STATUSES).toEqual(["scheduled", "completed", "cancelled"])
    expect(DEFAULT_STATUSES).toEqual(["scheduled", "completed"])
  })
})

describe("dayCounts", () => {
  it("marks every day a multi-day run occupies", () => {
    const counts = dayCounts([
      performance("run", "2026-10-13", { endDate: "2026-10-15" }),
      performance("night", "2026-10-14"),
    ])
    expect(counts).toEqual({ "2026-10-13": 1, "2026-10-14": 2, "2026-10-15": 1 })
  })

  it("counts nothing for a cancelled show that was filtered out", () => {
    expect(dayCounts(filterByStatus([performance("x", "2026-10-13", { status: "cancelled" })], []))).toEqual({})
  })
})

describe("weekStartIso", () => {
  // 2026-01-01 is a Thursday, so 2026-01-12 is a Monday and 2026-01-18 a Sunday.
  it("puts any day of the week on its Monday", () => {
    expect(weekStartIso("2026-01-14")).toBe("2026-01-12")
    expect(weekStartIso("2026-01-18")).toBe("2026-01-12")
    expect(weekStartIso("2026-01-12")).toBe("2026-01-12")
  })

  it("steps back into the previous month and the previous year", () => {
    expect(weekStartIso("2026-03-01")).toBe("2026-02-23")
    expect(weekStartIso("2026-01-01")).toBe("2025-12-29")
  })

  it("always lands on a Monday", () => {
    for (let day = 1; day <= 31; day += 1) {
      const iso = `2026-02-${`${day}`.padStart(2, "0")}`
      expect(dayOfWeek(weekStartIso(iso))).toBe(1)
    }
  })

  it("passes an unparseable value through instead of throwing", () => {
    expect(weekStartIso("not-a-date")).toBe("not-a-date")
  })
})

describe("weekDays", () => {
  it("lists the seven days of a week, Monday first", () => {
    expect(weekDays("2026-01-12")).toEqual([
      "2026-01-12",
      "2026-01-13",
      "2026-01-14",
      "2026-01-15",
      "2026-01-16",
      "2026-01-17",
      "2026-01-18",
    ])
  })

  it("crosses a month and a year boundary", () => {
    expect(weekDays("2025-12-29")).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ])
  })

  it("returns nothing rather than crashing on a malformed day", () => {
    expect(weekDays("nope")).toEqual([])
  })
})

describe("shiftWeek", () => {
  it("moves whole weeks and keeps the weekday", () => {
    expect(shiftWeek("2026-01-14", 1)).toBe("2026-01-21")
    expect(shiftWeek("2026-01-14", -1)).toBe("2026-01-07")
    expect(shiftWeek("2026-01-14", 4)).toBe("2026-02-11")
    expect(dayOfWeek(shiftWeek("2026-01-14", 4))).toBe(dayOfWeek("2026-01-14"))
  })

  it("crosses the year boundary", () => {
    expect(shiftWeek("2026-01-01", -1)).toBe("2025-12-25")
    expect(shiftWeek("2025-12-29", 1)).toBe("2026-01-05")
  })

  it("leaves a malformed day alone", () => {
    expect(shiftWeek("nope", 2)).toBe("nope")
  })
})

describe("groupByDay", () => {
  const shows = [
    performance("late", "2026-10-20", { startTime: "22:30" }),
    performance("early", "2026-10-20", { startTime: "19:00" }),
    performance("run", "2026-10-18", { endDate: "2026-10-19" }),
  ]

  it("orders the days and the shows inside each of them", () => {
    expect(groupByDay(shows).map((day) => [day.iso, day.performances.map((show) => show.id)])).toEqual([
      ["2026-10-18", ["run"]],
      ["2026-10-19", ["run"]],
      ["2026-10-20", ["early", "late"]],
    ])
  })

  it("restricts itself to the days it was given", () => {
    const week = weekDays(weekStartIso("2026-10-20"))
    expect(groupByDay(shows, { days: week }).map((day) => day.iso)).toEqual([
      "2026-10-19",
      "2026-10-20",
    ])
  })

  it("leaves out the days that hold nothing", () => {
    expect(groupByDay(shows, { days: ["2026-10-21"] })).toEqual([])
  })
})

describe("upcomingByDay", () => {
  it("takes what is still ahead and keeps a run that started earlier", () => {
    const days = upcomingByDay(
      [
        performance("past", "2026-10-01"),
        performance("running", "2026-10-13", { endDate: "2026-10-16" }),
        performance("ahead", "2026-11-02"),
      ],
      "2026-10-14",
    )
    expect(days.map((day) => day.iso)).toEqual([
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-11-02",
    ])
  })
})
