import type { Performance } from "@/interfaces"
import { eachDayBetween } from "@/libs/format"

/** Last day of a show: its end date when it has one, else its start date. */
export const performanceLastDay = (performance: Performance): string => {
  const end = performance.endDate
  return end && end >= performance.date ? end : performance.date
}

/** Every calendar day a show occupies, so multi-day runs fill the calendar. */
export const performanceDays = (performance: Performance): string[] =>
  eachDayBetween(performance.date, performance.endDate)
