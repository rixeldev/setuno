import type { TimestampLike } from "./timestamp"

export type PerformanceStatus = "scheduled" | "completed" | "cancelled"

/** A reusable venue label used by the performance form. */
export interface Venue {
  name: string
  address: string
  notes: string
}

/** A setlist attached to an event (denormalised so names render offline). */
export interface PerformanceSetlist {
  id: string
  name: string
}

export interface Performance {
  id: string
  organizationId: string
  name: string
  /** First day as `yyyy-mm-dd` (timezone independent, easy to query). */
  date: string
  /** Optional last day of a multi-day run (festival, tour…), else null. */
  endDate: string | null
  /** `HH:mm` 24h local start time, empty string when unknown. */
  startTime: string
  endTime: string
  venue: Venue
  notes: string
  /** Setlists attached to this show, in the order they were added. */
  setlists: PerformanceSetlist[]
  status: PerformanceStatus
  createdBy: string
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

export interface PerformanceInput {
  name: string
  date: string
  endDate: string | null
  startTime: string
  endTime: string
  venue: Venue
  notes: string
  setlists: PerformanceSetlist[]
  status: PerformanceStatus
}

export const PERFORMANCE_STATUS_LABELS: Record<PerformanceStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
}