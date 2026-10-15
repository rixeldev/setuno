import type { Performance, PerformanceStatus } from "@/interfaces/performance"
import { performanceDays } from "@/libs/performances"
import { parseIsoDate, toIsoDate } from "@/libs/validation"

/**
 * The shapes the band calendar can take (roadmap #51) and the maths behind
 * them, kept away from the screen so the part a calendar gets wrong — week
 * arithmetic — is unit-tested: Monday starts, month and year boundaries, and
 * daylight saving.
 *
 * The view and the status filter are held in the screen's state for now: they
 * are session preferences. Remembering them per band and per user is exactly
 * the storage shape Part A of #37 built for the songbook, and that is a
 * separate decision rather than a detail of this one.
 */
export type CalendarView = "month" | "week" | "agenda"

export const CALENDAR_VIEWS: readonly CalendarView[] = ["month", "week", "agenda"]

/** Every status the filter row offers, in the order it shows them. */
export const CALENDAR_STATUSES: readonly PerformanceStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
]

/**
 * What the calendar shows before anything has been switched: everything but the
 * cancelled, which the month grid has always skipped. A status field is the
 * only facet the model carries today — roadmap #46 adds `type: gig | rehearsal`,
 * and the filter row is built to grow a second group of chips beside this one.
 */
export const DEFAULT_STATUSES: readonly PerformanceStatus[] = ["scheduled", "completed"]

/**
 * Keeps the performances whose status is on. An empty selection falls back to
 * the default rather than emptying the calendar: tapping a chip twice should
 * never leave the reader looking at nothing with no visible cause.
 */
export const filterByStatus = (
  performances: readonly Performance[],
  statuses: readonly PerformanceStatus[],
): Performance[] => {
  const active = new Set(statuses.length > 0 ? statuses : DEFAULT_STATUSES)
  return performances.filter((performance) => active.has(performance.status))
}

/** How many shows each day holds — the dots under the month and week grids. */
export const dayCounts = (performances: readonly Performance[]): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const performance of performances) {
    // A multi-day run marks every day it occupies.
    for (const day of performanceDays(performance)) {
      counts[day] = (counts[day] ?? 0) + 1
    }
  }
  return counts
}

/** The Monday of the week `iso` belongs to, as `yyyy-mm-dd`. */
export const weekStartIso = (iso: string): string => {
  const date = parseIsoDate(iso)
  if (!date) return iso
  // Sunday is 0 in JS; the grid is Monday-first, so it is the last day of a week.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return toIsoDate(date)
}

/** The seven days of the week starting at `startIso`, Monday first. */
export const weekDays = (startIso: string): string[] => {
  const start = parseIsoDate(startIso)
  if (!start) return []
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime())
    date.setDate(start.getDate() + index)
    return toIsoDate(date)
  })
}

/** Moves a day by whole weeks, landing on the same weekday. */
export const shiftWeek = (iso: string, delta: number): string => {
  const date = parseIsoDate(iso)
  if (!date) return iso
  date.setDate(date.getDate() + delta * 7)
  return toIsoDate(date)
}

/**
 * Short weekday labels, Monday first, in `language` — the header both grids
 * draw. 2024-01-01 was a Monday, which is the first day of these grids.
 */
export const weekdayLabels = (language: string): string[] => {
  const formatter = new Intl.DateTimeFormat(language, { weekday: "short" })
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 1 + index)))
}

export interface CalendarDay {
  iso: string
  performances: Performance[]
}

/**
 * Groups shows by the day they occupy, in chronological order. A multi-day run
 * appears under **every** day it covers, exactly as the grids count it, and the
 * options narrow which of those days survive: `days` restricts them to a list
 * (the seven days of a week), `from` clips off everything before a day, so a
 * run that started last week still shows from today onwards rather than
 * dragging yesterday into an agenda of what is ahead. Days that hold nothing
 * are never emitted: the strip above already shows the shape of the week, and a
 * column of empty headers is noise.
 */
export const groupByDay = (
  performances: readonly Performance[],
  options: { days?: readonly string[]; from?: string } = {},
): CalendarDay[] => {
  const allowed = options.days ? new Set(options.days) : null
  const buckets = new Map<string, Performance[]>()

  for (const performance of performances) {
    for (const day of performanceDays(performance)) {
      if (allowed && !allowed.has(day)) continue
      if (options.from && day < options.from) continue
      const bucket = buckets.get(day)
      if (bucket) bucket.push(performance)
      else buckets.set(day, [performance])
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, entries]) => ({
      iso,
      performances: [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
}

/** The shows from `from` onwards, grouped by day — the agenda view's body. */
export const upcomingByDay = (
  performances: readonly Performance[],
  from: string,
): CalendarDay[] => groupByDay(performances, { from })
