import type { TimestampLike } from "./timestamp"

export type PerformanceStatus = "scheduled" | "completed" | "cancelled"

/**
 * What kind of event it is (roadmap #46). Absent on every older document, so
 * `mapPerformance` reads absence back as `gig` and no migration exists.
 */
export type PerformanceType = "gig" | "rehearsal"

/**
 * What actually happened to a song while the band ran the show (roadmap #45):
 * it was played, cut from the night, or played differently than written.
 */
export type ShowOutcome = "played" | "skipped" | "improvised"

/** One song's entry in an event's show log (roadmap #45). */
export interface ShowLogEntry {
  songId: string
  outcome: ShowOutcome
  /**
   * Seconds the band actually spent on this song while the show ran, measured
   * by the reader's live session with break time excluded. `0` = marked but
   * never measured (a song marked from the post-gig report, for instance).
   */
  actualSec: number
  /** Free-form cue attached during the show or afterwards ("cut short"). */
  note: string
  /** Epoch ms of the last change to this entry — client time, offline-safe. */
  updatedAt: number
}

/**
 * The i18n keys for each mark (roadmap #45). Shared by the live strip and the
 * post-gig report so the two pickers can never spell an outcome differently —
 * the same "declared once" trick as `PERFORMANCE_TYPE_KEYS` below.
 */
export const SHOW_OUTCOME_KEYS: Record<ShowOutcome, string> = {
  played: "showLog.outcomePlayed",
  skipped: "showLog.outcomeSkipped",
  improvised: "showLog.outcomeImprovised",
}

/**
 * The i18n keys for the pair (roadmap #46). `performances.gig` already means
 * "Event" — it is the generic word the detail header prints — so the type
 * labels need their own explicit keys, declared once for every screen that
 * renders the chips.
 */
export const PERFORMANCE_TYPE_KEYS: Record<PerformanceType, string> = {
  gig: "performances.typeGig",
  rehearsal: "performances.typeRehearsal",
}

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

/**
 * A member's RSVP for one event (roadmap #47). Stored as a map on the
 * performance document — `{ [uid]: status }` — absent on every older document
 * (no answers yet), and written per key with a dot-path update so two members
 * answering at the same time can never clobber each other. Only ever written
 * through `services/eventLogistics.ts#setAttendance`, which touches the
 * caller's own key alone (the rules enforce exactly that).
 */
export type AttendanceStatus = "yes" | "maybe" | "no"

/**
 * The i18n keys for each answer, declared once for every screen that renders
 * the chips (the `PERFORMANCE_TYPE_KEYS`/`SHOW_OUTCOME_KEYS` precedent).
 */
export const ATTENDANCE_STATUS_KEYS: Record<AttendanceStatus, string> = {
  yes: "performances.rsvpGoing",
  maybe: "performances.rsvpMaybe",
  no: "performances.rsvpNo",
}

/**
 * "Who brings what" (roadmap #47): one task per thing, assigned to a member
 * (or to nobody = anyone's job), with a done tick. Lives in the event's
 * `tasks` subcollection — logistics belongs to the event, and a subcollection
 * keeps the event document itself small and never rewritten by a checkbox.
 */
export interface EventTask {
  id: string
  title: string
  /** Uid of the member it is assigned to, or "" = anyone. */
  assignedTo: string
  done: boolean
  createdBy: string
  /** Client time on purpose (the version-history precedent): order must */
  /** survive an offline write while a server timestamp is still null. */
  createdAt: TimestampLike
  updatedAt: TimestampLike
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
  /** Gig or rehearsal (roadmap #46); absent documents read back as `gig`. */
  type: PerformanceType
  /**
   * Live show log (roadmap #45): one entry per song the band marked or timed
   * while running the show from the reader, plus whatever the post-gig report
   * added afterwards. Absent on every older document, so it reads back as an
   * empty log and no migration exists. It is **not** part of `PerformanceInput`
   * below — the log is written only through `services/performances.ts#
   * saveShowLog` (its own field-level update), so the event form and every
   * status tap can never clobber what the show recorded, and vice versa.
   */
  showLog: ShowLogEntry[]
  /**
   * Who answered the event (roadmap #47): uid → RSVP. Absent on every older
   * document (reads back as no answers) and **not** part of `PerformanceInput`
   * below — it is written only through `services/eventLogistics.ts#
   * setAttendance` (one dot-path key per member), so the event form and every
   * status tap can never clobber the band's answers, and vice versa.
   */
  attendance: Record<string, AttendanceStatus>
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
  /**
   * **Required, not optional** (the #42 lesson): every call site of
   * `updatePerformance` only ever means "the event changed", and an omitted
   * optional would silently turn the band's rehearsals into gigs on the next
   * status tap.
   */
  type: PerformanceType
}

export const PERFORMANCE_STATUS_LABELS: Record<PerformanceStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
}