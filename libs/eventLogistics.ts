import type { AttendanceStatus, EventTask, OrganizationMember } from "@/interfaces"
import { toMillis } from "@/interfaces/timestamp"

/**
 * Event logistics (roadmap #47), pure: the RSVP map and the "who brings what"
 * tasks. No timers, no React, no Firestore — the service maps untrusted
 * documents through these functions, so invalid stored data self-heals on
 * read and every rule the rules file pins at document level has a tested
 * twin here (the `markers`/`showLog` precedent exactly).
 */

/** The three answers an event can carry. */
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = ["yes", "maybe", "no"]

/**
 * Rules cannot iterate a map, so the document shape (a map, at most
 * `ATTENDANCE_MAX` keys) is pinned there and each entry is sanitized here.
 * Anything unrecognised — an unknown status, a non-string uid — is dropped:
 * invalid stored data must never reach the UI or a write-back.
 */
export const ATTENDANCE_MAX = 100

const isAttendanceStatus = (value: unknown): value is AttendanceStatus =>
  value === "yes" || value === "maybe" || value === "no"

/** Sanitizes a stored (or about-to-be-written) attendance map. */
export const mapAttendance = (raw: unknown): Record<string, AttendanceStatus> => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([uid, status]) => uid.length > 0 && isAttendanceStatus(status))
    .slice(0, ATTENDANCE_MAX)
  return Object.fromEntries(entries) as Record<string, AttendanceStatus>
}

/** The RSVP buckets for display, in the band's own member order. */
export interface AttendanceBuckets {
  going: OrganizationMember[]
  maybe: OrganizationMember[]
  no: OrganizationMember[]
  /** Members of the band who have not answered (yet). */
  unanswered: OrganizationMember[]
}

/** Groups the roster by their answer; nobody's answer hides them from the rest. */
export const partitionAttendance = (
  attendance: Record<string, AttendanceStatus>,
  members: readonly OrganizationMember[],
): AttendanceBuckets => {
  const buckets: AttendanceBuckets = { going: [], maybe: [], no: [], unanswered: [] }
  for (const member of members) {
    const status = attendance[member.uid]
    if (status === "yes") buckets.going.push(member)
    else if (status === "maybe") buckets.maybe.push(member)
    else if (status === "no") buckets.no.push(member)
    else buckets.unanswered.push(member)
  }
  return buckets
}

/** Longest a task title may run (the rules pin the same number). */
export const TASK_TITLE_MAX = 120

/** Trims and bounds a task title; empty means "nothing to store". */
export const taskTitle = (value: string): string => value.trim().slice(0, TASK_TITLE_MAX)

/** At most this many tasks per event — checked on create, client-side. */
export const MAX_EVENT_TASKS = 50

/**
 * Pending work first, finished work last (a checklist that leads with what is
 * left); ties break by creation time then id, so every device reads the same
 * order and a list can never shuffle between renders.
 */
export const sortTasks = (tasks: readonly EventTask[]): EventTask[] =>
  [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    // `toMillis` tolerates a queued local `Date` as well as a stored
    // timestamp; anything unmeasured sorts first, then by id — never a
    // shuffle between renders.
    const byTime = (toMillis(a.createdAt) ?? 0) - (toMillis(b.createdAt) ?? 0)
    if (byTime !== 0) return byTime
    return a.id.localeCompare(b.id)
  })
