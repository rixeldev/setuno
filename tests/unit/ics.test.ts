import { describe, expect, it } from "vitest"

import {
  addIcsDays,
  addIcsHours,
  buildIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  icsFileName,
  icsSlug,
  performanceToIcsEvent,
  toIcsStamp,
  type IcsEvent,
} from "@/libs/ics"
import type { Performance, TimestampLike } from "@/interfaces"

const NOW = new Date(Date.UTC(2026, 9, 13, 11, 30, 0))

const event = (overrides: Partial<IcsEvent> = {}): IcsEvent => ({
  uid: "org-1-show-1@setuno.app",
  date: "2026-10-13",
  endDate: null,
  startTime: "",
  endTime: "",
  summary: "Rehearsal",
  location: "",
  description: "",
  cancelled: false,
  ...overrides,
})

const TIMESTAMP: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const performance = (overrides: Partial<Performance> = {}): Performance => ({
  id: "show-1",
  organizationId: "org-1",
  name: "Festival",
  date: "2026-10-13",
  endDate: null,
  startTime: "20:00",
  endTime: "22:30",
  venue: { name: "Sala Sur", address: "Calle 1", notes: "" },
  notes: "Soundcheck a las 18 h",
  setlists: [{ id: "s1", name: "Set A" }],
  status: "scheduled",
  type: "gig",
  showLog: [],
  showNotes: [],
  attendance: {},
  liveShare: null,
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

describe("iCalendar text", () => {
  it("escapes the reserved characters", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne")
  })

  it("folds long lines on whole code points and unfolds cleanly", () => {
    const value = "á".repeat(120)
    const folded = foldIcsLine(`SUMMARY:${value}`)
    const physical = folded.split("\r\n")
    expect(physical.length).toBeGreaterThan(1)
    for (const line of physical.slice(1)) expect(line.startsWith(" ")).toBe(true)
    expect(physical.map((line, index) => (index === 0 ? line : line.slice(1))).join("")).toBe(
      `SUMMARY:${value}`,
    )
  })

  it("keeps every octet-bounded line within the limit", () => {
    const folded = foldIcsLine(`SUMMARY:${"é".repeat(60)}`)
    for (const line of folded.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75)
    }
  })
})

describe("iCalendar dates", () => {
  it("adds days in UTC", () => {
    expect(addIcsDays("2026-10-31", 1)).toBe("2026-11-01")
    expect(addIcsDays("2026-02-28", 1)).toBe("2026-03-01")
  })

  it("adds hours and clamps to the end of the day", () => {
    expect(addIcsHours("20:00", 2)).toBe("22:00")
    expect(addIcsHours("23:30", 2)).toBe("23:59")
  })

  it("formats a UTC stamp", () => {
    expect(toIcsStamp(NOW)).toBe("20261013T113000Z")
  })
})

describe("iCalendar calendar", () => {
  it("wraps events in a CRLF VCALENDAR document", () => {
    const content = buildIcsCalendar([event()], { now: NOW })
    expect(content.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true)
    expect(content.endsWith("END:VCALENDAR\r\n")).toBe(true)
    // Every newline is CRLF, never a bare LF.
    expect(content.replace(/\r\n/g, "")).not.toContain("\n")
  })

  it("writes an all-day event with an exclusive end date", () => {
    const content = buildIcsCalendar([event()], { now: NOW })
    expect(content).toContain("DTSTART;VALUE=DATE:20261013\r\n")
    expect(content).toContain("DTEND;VALUE=DATE:20261014\r\n")
  })

  it("spans a multi-day run with an exclusive end date", () => {
    const content = buildIcsCalendar([event({ endDate: "2026-10-15" })], { now: NOW })
    expect(content).toContain("DTEND;VALUE=DATE:20261016\r\n")
  })

  it("writes timed events as floating local times", () => {
    const content = buildIcsCalendar([event({ startTime: "20:00", endTime: "22:30" })], {
      now: NOW,
    })
    expect(content).toContain("DTSTART:20261013T200000\r\n")
    expect(content).toContain("DTEND:20261013T223000\r\n")
  })

  it("defaults a missing end time to two hours", () => {
    const content = buildIcsCalendar([event({ startTime: "20:00" })], { now: NOW })
    expect(content).toContain("DTEND:20261013T220000\r\n")
  })

  it("marks cancelled events", () => {
    expect(buildIcsCalendar([event({ cancelled: true })], { now: NOW })).toContain(
      "STATUS:CANCELLED\r\n",
    )
  })

  it("names the feed", () => {
    expect(buildIcsCalendar([], { calendarName: "The Band", now: NOW })).toContain(
      "X-WR-CALNAME:The Band\r\n",
    )
  })
})

describe("performanceToIcsEvent", () => {
  it("keeps a stable UID built from the stored ids", () => {
    const first = performanceToIcsEvent(performance(), "org-1")
    const renamed = performanceToIcsEvent(performance({ name: "Other" }), "org-1")
    expect(first.uid).toBe("org-1-show-1@setuno.app")
    expect(renamed.uid).toBe(first.uid)
    expect(buildIcsCalendar([first], { now: NOW })).toContain(`UID:${first.uid}\r\n`)
  })

  it("composes the location and description from the stored data", () => {
    const result = performanceToIcsEvent(performance(), "org-1")
    expect(result.location).toBe("Sala Sur, Calle 1")
    expect(result.description).toBe("Soundcheck a las 18 h\nSet A")
    expect(result.cancelled).toBe(false)
  })
})

describe("export file names", () => {
  it("slugifies accents and punctuation", () => {
    expect(icsSlug("Café de la Noche!")).toBe("cafe-de-la-noche")
    expect(icsFileName("My Band")).toBe("setuno-my-band.ics")
    expect(icsFileName("")).toBe("setuno-setuno.ics")
  })
})
