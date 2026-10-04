import type { TimestampLike } from "./timestamp"

export type PerformanceStatus = "scheduled" | "completed" | "cancelled"

/** A reusable venue label used by the performance form. */
export interface Venue {
  name: string
  address: string
  notes: string
}

export interface Performance {
  id: string
  organizationId: string
  name: string
  /** Calendar day as `yyyy-mm-dd` (timezone independent, easy to query). */
  date: string
  /** `HH:mm` 24h local start time, empty string when unknown. */
  startTime: string
  endTime: string
  venue: Venue
  notes: string
  /** Optional setlist attached to this show. */
  setlistId: string | null
  setlistName: string | null
  status: PerformanceStatus
  createdBy: string
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

export interface PerformanceInput {
  name: string
  date: string
  startTime: string
  endTime: string
  venue: Venue
  notes: string
  setlistId: string | null
  status: PerformanceStatus
}

export const PERFORMANCE_STATUS_LABELS: Record<PerformanceStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
}