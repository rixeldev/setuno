import type { Performance } from "@/interfaces"

/**
 * Minimal iCalendar (RFC 5545) writer for the band calendar (roadmap #50).
 *
 * Everything is generated on the device — no server round-trip — so the export
 * works offline. Every event carries a UID derived from its Firestore ids, so
 * re-importing a later export updates the previous event instead of adding a
 * duplicate. Times are written as *floating local* values, because a performance
 * only stores its venue's wall-clock time, never a timezone.
 */
export interface IcsEvent {
  /** Stable across edits, so the calendar app matches it on re-import. */
  uid: string
  /** First day as `yyyy-mm-dd`. */
  date: string
  /** Last day of a multi-day run, else null. */
  endDate: string | null
  /** `HH:mm` local start time; empty means an all-day event. */
  startTime: string
  endTime: string
  summary: string
  location: string
  description: string
  cancelled: boolean
}

export interface IcsCalendarOptions {
  /** Shown by the calendar app as the feed name (`X-WR-CALNAME`). */
  calendarName?: string
  /** Reference instant for `DTSTAMP`; injectable so tests stay deterministic. */
  now?: Date
  productId?: string
}

const DEFAULT_PRODUCT_ID = "-//Setuno//Setuno Calendar//EN"
const CRLF = "\r\n"
/** RFC 5545 folds at 75 octets; a continuation line loses one to its leader. */
const FOLD_LIMIT = 74
const TIME_PATTERN = /^\d{2}:\d{2}$/

const pad = (value: number): string => `${value}`.padStart(2, "0")

/** Escapes the characters RFC 5545 reserves inside a TEXT value. */
export const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")

const utf8Length = (value: string): number => {
  let bytes = 0
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x7f) bytes += 1
    else if (code <= 0x7ff) bytes += 2
    else if (code <= 0xffff) bytes += 3
    else bytes += 4
  }
  return bytes
}

/**
 * Folds a content line to the 75-octet limit, always breaking on a whole code
 * point so multi-byte characters never get cut in half.
 */
export const foldIcsLine = (line: string): string => {
  if (utf8Length(line) <= 75) return line
  const parts: string[] = []
  let current = ""
  let currentBytes = 0
  for (const char of line) {
    const charBytes = utf8Length(char)
    const budget = parts.length === 0 ? 75 : FOLD_LIMIT
    if (currentBytes + charBytes > budget) {
      parts.push(current)
      current = ""
      currentBytes = 0
    }
    current += char
    currentBytes += charBytes
  }
  if (current.length > 0) parts.push(current)
  return parts.join(`${CRLF} `)
}

/** `yyyy-mm-dd` → `yyyymmdd`. */
export const toIcsDate = (date: string): string => date.replace(/-/g, "")

/** Adds whole days to a `yyyy-mm-dd` date, in UTC so DST never shifts it. */
export const addIcsDays = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number)
  if (!year || !month || !day) return date
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

/** Adds hours to a `HH:mm` time, clamped to the end of the same day. */
export const addIcsHours = (time: string, hours: number): string => {
  const [hour, minute] = time.split(":").map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time
  const total = Math.min(hour * 60 + minute + hours * 60, 23 * 60 + 59)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** `yyyy-mm-dd` + `HH:mm` → `yyyymmddTHHmm00` (floating local time). */
const toIcsDateTime = (date: string, time: string): string =>
  `${toIcsDate(date)}T${time.replace(":", "")}00`

/** `Date` → `yyyymmddThhmmssZ` (UTC). */
export const toIcsStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`

const timingLines = (event: IcsEvent): string[] => {
  if (!TIME_PATTERN.test(event.startTime)) {
    // All-day: DTEND is exclusive, so it is the day *after* the last one.
    const lastDay = event.endDate ?? event.date
    return [
      `DTSTART;VALUE=DATE:${toIcsDate(event.date)}`,
      `DTEND;VALUE=DATE:${toIcsDate(addIcsDays(lastDay, 1))}`,
    ]
  }
  const endDay = event.endDate ?? event.date
  const endTime = TIME_PATTERN.test(event.endTime) ? event.endTime : addIcsHours(event.startTime, 2)
  return [
    `DTSTART:${toIcsDateTime(event.date, event.startTime)}`,
    `DTEND:${toIcsDateTime(endDay, endTime)}`,
  ]
}

/** Serialises events into a complete `VCALENDAR` document (CRLF line endings). */
export const buildIcsCalendar = (events: IcsEvent[], options: IcsCalendarOptions = {}): string => {
  const stamp = toIcsStamp(options.now ?? new Date())
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${options.productId ?? DEFAULT_PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]
  if (options.calendarName) lines.push(`X-WR-CALNAME:${escapeIcsText(options.calendarName)}`)
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      ...timingLines(event),
      `SUMMARY:${escapeIcsText(event.summary)}`,
      ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
      ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
      `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    )
  }
  lines.push("END:VCALENDAR")
  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`
}

/** Maps a stored performance to a calendar event. */
export const performanceToIcsEvent = (
  performance: Performance,
  organizationId: string,
): IcsEvent => {
  const location = [performance.venue.name, performance.venue.address]
    .filter((value) => value.trim().length > 0)
    .join(", ")
  const setlists = performance.setlists.map((entry) => entry.name).filter(Boolean).join(", ")
  const description = [performance.notes.trim(), setlists].filter(Boolean).join("\n")
  return {
    uid: `${organizationId}-${performance.id}@setuno.app`,
    date: performance.date,
    endDate: performance.endDate,
    startTime: performance.startTime,
    endTime: performance.endTime,
    summary: performance.name,
    location,
    description,
    cancelled: performance.status === "cancelled",
  }
}

/** `Café de la Noche!` → `cafe-de-la-noche` (ASCII slug for a file name). */
export const icsSlug = (label: string): string =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "") || "setuno"

/** Download file name for an export, e.g. `setuno-my-band.ics`. */
export const icsFileName = (label: string): string => `setuno-${icsSlug(label)}.ics`
