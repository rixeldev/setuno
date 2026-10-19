import type { Performance, PerformanceType } from "@/interfaces"
import { eachDayBetween } from "@/libs/format"

/** Last day of a show: its end date when it has one, else its start date. */
export const performanceLastDay = (performance: Performance): string => {
  const end = performance.endDate
  return end && end >= performance.date ? end : performance.date
}

/** Every calendar day a show occupies, so multi-day runs fill the calendar. */
export const performanceDays = (performance: Performance): string[] =>
  eachDayBetween(performance.date, performance.endDate)

/** Every event type the model carries (roadmap #46), in filter-row order. */
export const EVENT_TYPES: readonly PerformanceType[] = ["gig", "rehearsal"]

/**
 * Nothing is hidden until the band narrows the list — the same contract as
 * the calendar's `DEFAULT_STATUSES`.
 */
export const DEFAULT_EVENT_TYPES: readonly PerformanceType[] = ["gig", "rehearsal"]

/**
 * Keeps the events whose type is on (roadmap #46). An empty selection falls
 * back to the default rather than emptying the view: tapping a chip twice
 * must never leave a screen blank with no visible cause — the exact rule
 * `filterByStatus` in `libs/calendarView.ts` follows.
 */
export const filterByEventType = (
  performances: readonly Performance[],
  types: readonly PerformanceType[],
): Performance[] => {
  const active = new Set(types.length > 0 ? types : DEFAULT_EVENT_TYPES)
  return performances.filter((performance) => active.has(performance.type))
}

/**
 * Restores the ascending-by-date order every consumer was built on, after the
 * listener windows on the **newest** events (P0.9 / #82): querying
 * `orderBy("date", "asc")` + `limitTo(N)` fills the window with the band's
 * *oldest* N events — past ~300 events every new show, the dashboard's next
 * show included, would silently drop out of the subscription. So the query
 * asks for desc to pick the window, and this sorts what comes back so
 * `partitionPerformances`, the dashboard's soonest-first slice and the
 * calendar agenda keep receiving the order they were written against. Ties
 * break by start time then id, so two devices always render the same order.
 */
export const orderPerformancesAsc = (performances: readonly Performance[]): Performance[] =>
  [...performances].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.id.localeCompare(b.id),
  )

/**
 * A rehearsal is not a show (roadmap #46): the stats' "shows played", music
 * minutes and the year recap count **gigs**, while #34's usage history counts
 * every completed event — a rehearsal where the band ran a setlist *was* a
 * play. Anything that is not a rehearsal counts as a gig, so an older
 * document (no `type` field) keeps counting as the show it always was.
 */
export const isGig = (performance: Performance): boolean => performance.type !== "rehearsal"
