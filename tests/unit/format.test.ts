import { describe, expect, it } from "vitest"

import {
  eachDayBetween,
  formatDate,
  formatDateLong,
  formatDateRange,
  formatDateTime,
  formatDuration,
  formatDurationLong,
  formatRelativeDay,
  formatRelativeTime,
  formatShortDate,
  formatTime,
  initials,
  isSameDay,
  parseDurationInput,
  pluralize,
  sortByDateAsc,
  sortByDateDesc,
  startOfDay,
} from "@/libs/format"

describe("durations", () => {
  it("renders mm:ss", () => {
    expect(formatDuration(0)).toBe("--:--")
    expect(formatDuration(222)).toBe("3:42")
    expect(formatDuration(59)).toBe("0:59")
  })

  it("switches to hours and minutes for long setlists", () => {
    expect(formatDuration(3 * 3600 + 42 * 60)).toBe("3h 42m")
    expect(formatDurationLong(3 * 3600 + 42 * 60)).toBe("3h 42m")
    expect(formatDurationLong(42 * 60 + 30)).toBe("43m")
  })

  it("has a placeholder for unknown lengths", () => {
    expect(formatDuration(null)).toBe("--:--")
    expect(formatDuration(undefined)).toBe("--:--")
    expect(formatDuration(Number.NaN)).toBe("--:--")
    expect(formatDurationLong(null)).toBe("--")
  })

  it("parses what the user typed back into seconds", () => {
    expect(parseDurationInput("3:42")).toBe(222)
    expect(parseDurationInput("0:30")).toBe(30)
    expect(parseDurationInput("3:60")).toBeNull()
    expect(parseDurationInput("3.42")).toBeNull()
    expect(parseDurationInput("")).toBeNull()
  })

  it("round-trips a duration through the input field", () => {
    expect(parseDurationInput("4:05")).toBe(245)
    expect(formatDuration(parseDurationInput("4:05"))).toBe("4:05")
  })
})

describe("dates", () => {
  it("leaves off the time part", () => {
    const date = new Date(2026, 9, 2, 21, 30)
    expect(startOfDay(date).getHours()).toBe(0)
    expect(formatDate(date)).toBe("October 2, 2026")
    expect(formatShortDate(date)).toBe("Oct 2")
  })

  it("uses an em dash for a missing date", () => {
    expect(formatDate(null)).toBe("—")
    expect(formatDate(undefined)).toBe("—")
    expect(formatShortDate(null)).toBe("—")
  })

  it("compares days", () => {
    expect(isSameDay(new Date(2026, 9, 2, 8), new Date(2026, 9, 2, 23))).toBe(true)
    expect(isSameDay(new Date(2026, 9, 2), new Date(2026, 9, 3))).toBe(false)
  })

  it("labels the days around a gig", () => {
    const today = new Date()
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10)
    expect(formatRelativeDay(today)).toBe("Today")
    expect(formatRelativeDay(tomorrow)).toBe("Tomorrow")
    expect(formatRelativeDay(yesterday)).toBe("Yesterday")
    expect(formatRelativeDay(nextWeek)).toBe(formatDate(nextWeek))
    expect(formatRelativeDay(null)).toBe("—")
  })

  it("uses translated labels for the days around today", () => {
    const today = new Date()
    const labels = { today: "Hoy", tomorrow: "Mañana", yesterday: "Ayer" }
    expect(formatRelativeDay(today, labels)).toBe("Hoy")
    expect(formatRelativeDay(null, labels)).toBe("—")
  })

  it("formats a long date in the requested locale", () => {
    const date = new Date(2026, 9, 4)
    expect(formatDateLong(date, "en").toLowerCase()).toContain("october")
    expect(formatDateLong(date, "es").toLowerCase()).toContain("octubre")
    expect(formatDateLong(null)).toBe("—")
  })

  it("shows how long ago something happened", () => {
    const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * 60_000)
    expect(formatRelativeTime(new Date())).toBe("just now")
    expect(formatRelativeTime(minutesAgo(30))).toBe("30 min ago")
    expect(formatRelativeTime(minutesAgo(60 * 5))).toBe("5h ago")
    expect(formatRelativeTime(minutesAgo(60 * 24 * 3))).toBe("3 days ago")
    expect(formatRelativeTime(new Date(Date.now() + 60 * 60_000))).toBe("in 1h")
    expect(formatRelativeTime(null)).toBe("")
  })

  it("walks every day of a multi-day run", () => {
    expect(eachDayBetween("2026-10-27", "2026-10-29")).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
    ])
    expect(eachDayBetween("2026-10-27")).toEqual(["2026-10-27"])
    expect(eachDayBetween("2026-10-29", "2026-10-27")).toEqual(["2026-10-29"])
    expect(eachDayBetween("nope")).toEqual([])
  })

  it("caps an absurd range", () => {
    expect(eachDayBetween("2026-01-01", "2030-01-01", 5)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ])
  })

  it("builds a date range label", () => {
    const single = formatDateRange("2026-10-27", null, "en")
    expect(single).toContain("27")
    expect(single).not.toContain("–")

    const range = formatDateRange("2026-10-27", "2026-10-29", "en")
    expect(range).toContain("27")
    expect(range).toContain("29")
    expect(range).toContain("–")
  })

  it("falls back to the start day when the end is not after it", () => {
    const single = formatDateRange("2026-10-27", null, "en")
    expect(formatDateRange("2026-10-27", "2026-10-27", "en")).toBe(single)
    expect(formatDateRange("2026-10-27", "2026-10-20", "en")).toBe(single)
    expect(formatDateRange("nope", null, "en")).toBe("—")
  })
})

describe("times", () => {
  it("converts 24h to 12h", () => {
    expect(formatTime("21:00")).toBe("9:00 PM")
    expect(formatTime("09:30")).toBe("9:30 AM")
    expect(formatTime("00:15")).toBe("12:15 AM")
    expect(formatTime("12:00")).toBe("12:00 PM")
  })

  it("leaves unparseable values alone", () => {
    expect(formatTime("8pm")).toBe("8pm")
    expect(formatTime(null)).toBe("")
  })

  it("combines a date and a time", () => {
    const date = new Date(2026, 9, 2)
    expect(formatDateTime(date, "21:00")).toBe("October 2, 2026 · 9:00 PM")
    expect(formatDateTime(date)).toBe("October 2, 2026")
    expect(formatDateTime(null)).toBe("—")
  })
})

describe("text helpers", () => {
  it("pluralises", () => {
    expect(pluralize(1, "song")).toBe("1 song")
    expect(pluralize(0, "song")).toBe("0 songs")
    expect(pluralize(3, "show", "shows")).toBe("3 shows")
  })

  it("builds avatar initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL")
    expect(initials("Prince")).toBe("P")
    expect(initials("  ").trim()).toBe("")
  })
})

describe("sorting", () => {
  const events = [
    { name: "middle", at: new Date(2026, 9, 15).getTime() },
    { name: "late", at: new Date(2026, 9, 20).getTime() },
    { name: "early", at: new Date(2026, 9, 1).getTime() },
  ]

  it("sorts by timestamp", () => {
    expect(sortByDateAsc(events, (event) => event.at).map((event) => event.name)).toEqual([
      "early",
      "middle",
      "late",
    ])
    expect(sortByDateDesc(events, (event) => event.at).map((event) => event.name)).toEqual([
      "late",
      "middle",
      "early",
    ])
  })

  it("treats a missing timestamp as the oldest", () => {
    const withGap = [...events, { name: "unknown", at: null }]
    expect(sortByDateAsc(withGap, (event) => event.at)[0]?.name).toBe("unknown")
  })

  it("does not mutate the input array", () => {
    const original = [...events]
    sortByDateDesc(events, (event) => event.at)
    expect(events).toEqual(original)
  })
})