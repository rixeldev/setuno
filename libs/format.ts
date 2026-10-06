/** Formatting helpers for dates, times and durations (locale aware). */

export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return "--:--"
  }
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${hours}h ${`${minutes}`.padStart(2, "0")}m`
  }
  return `${minutes}:${`${secs}`.padStart(2, "0")}`
}

/** Duration estimate for a setlist: "1h 42m" / "42m". */
export const formatDurationLong = (seconds: number | null | undefined): string => {
  if (!seconds || seconds <= 0) return "--"
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export const parseDurationInput = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const minutes = Number(match[1] ?? 0)
  const seconds = Number(match[2] ?? 0)
  if (seconds > 59) return null
  return minutes * 60 + seconds
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const SHORT_MONTHS = MONTHS.map((month) => month.slice(0, 3))

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export const formatDate = (date: Date | null | undefined): string => {
  if (!date) return "—"
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export const formatShortDate = (date: Date | null | undefined): string => {
  if (!date) return "—"
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`
}

export const formatWeekday = (date: Date | null | undefined): string => {
  if (!date) return ""
  return date.toLocaleDateString(undefined, { weekday: "short" })
}

const isoFromDate = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`

/**
 * Every `yyyy-mm-dd` from `startIso` to `endIso` (both inclusive). A missing or
 * earlier end returns just the start day; the list is capped so a mistyped date
 * can never flood the calendar.
 */
export const eachDayBetween = (
  startIso: string,
  endIso?: string | null,
  maxDays = 62,
): string[] => {
  const start = new Date(`${startIso}T12:00:00`)
  if (Number.isNaN(start.getTime())) return []
  const end = endIso ? new Date(`${endIso}T12:00:00`) : start
  if (Number.isNaN(end.getTime()) || end <= start) return [startIso]

  const days: string[] = []
  const cursor = new Date(start)
  while (cursor <= end && days.length < maxDays) {
    days.push(isoFromDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** "27 oct – 29 oct" (localized) or just the start day when there is no range. */
export const formatDateRange = (
  startIso: string,
  endIso?: string | null,
  locale?: string,
): string => {
  const start = new Date(`${startIso}T12:00:00`)
  if (Number.isNaN(start.getTime())) return "—"
  const formatter = new Intl.DateTimeFormat(locale || undefined, { day: "numeric", month: "short" })
  const label = formatter.format(start)
  if (!endIso || endIso <= startIso) return label
  const end = new Date(`${endIso}T12:00:00`)
  if (Number.isNaN(end.getTime())) return label
  return `${label} – ${formatter.format(end)}`
}

/** Pieces of a date stamp ("Sat" / "24" / "Oct") used by cards and lists. */
export const dayStamp = (
  date: Date | null | undefined,
): { weekday: string; day: string; month: string } => {
  if (!date) return { weekday: "--", day: "--", month: "" }
  return {
    weekday: formatWeekday(date),
    day: `${date.getDate()}`,
    month: SHORT_MONTHS[date.getMonth()],
  }
}

/** "Saturday, 4 October" in the given locale (falls back to a plain date). */
export const formatDateLong = (date: Date | null | undefined, locale?: string): string => {
  if (!date) return "—"
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date)
  } catch {
    // Intl is unavailable on some engines: keep a readable fallback.
    return formatDate(date)
  }
}

/** Translatable words for the near-day labels of `formatRelativeDay`. */
export interface RelativeDayLabels {
  today: string
  tomorrow: string
  yesterday: string
}

/** "Today · 9:00 PM" style relative labels used in agendas. */
export const formatRelativeDay = (
  date: Date | null | undefined,
  labels?: RelativeDayLabels,
): string => {
  if (!date) return "—"
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return labels?.today ?? "Today"
  if (diffDays === 1) return labels?.tomorrow ?? "Tomorrow"
  if (diffDays === -1) return labels?.yesterday ?? "Yesterday"
  if (diffDays > 1 && diffDays < 7) return target.toLocaleDateString(undefined, { weekday: "long" })
  return formatDate(date)
}

/** `21:00` -> `9:00 PM` (invalid input is returned unchanged). */
export const formatTime = (value: string | null | undefined): string => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((value ?? "").trim())
  if (!match) return value?.trim() ?? ""
  const hours = Number(match[1] ?? 0)
  const minutes = match[2] ?? "00"
  const suffix = hours >= 12 ? "PM" : "AM"
  const displayHours = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHours}:${minutes} ${suffix}`
}

/** "Oct 16, 2026 · 9:00 PM" */
export const formatDateTime = (date: Date | null | undefined, time?: string): string => {
  if (!date) return "—"
  const timeLabel = time ? formatTime(time) : ""
  return timeLabel ? `${formatDate(date)} · ${timeLabel}` : formatDate(date)
}

/** "3 days ago" / "in 2 weeks" */
export const formatRelativeTime = (date: Date | null | undefined): string => {
  if (!date) return ""
  const diffMs = date.getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60_000)
  if (Math.abs(diffMinutes) < 1) return "just now"
  if (Math.abs(diffMinutes) < 60) {
    return diffMinutes > 0 ? `in ${diffMinutes} min` : `${Math.abs(diffMinutes)} min ago`
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`
  }
  const diffDays = Math.round(diffHours / 24)
  if (Math.abs(diffDays) < 30) {
    return diffDays > 0 ? `in ${diffDays} day${diffDays === 1 ? "" : "s"}` : `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`
  }
  return formatDate(date)
}

export const pluralize = (count: number, singular: string, plural?: string): string =>
  `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`

/** First letters of a name, capped at `max` (used by avatars). */
export const initials = (name: string, max = 2): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, Math.max(1, max))
    .map((part) => (part[0] ?? "").toUpperCase())
    .join("")

export const sortByDateDesc = <T>(items: T[], getDate: (item: T) => number | null): T[] =>
  [...items].sort((a, b) => (getDate(b) ?? 0) - (getDate(a) ?? 0))

export const sortByDateAsc = <T>(items: T[], getDate: (item: T) => number | null): T[] =>
  [...items].sort((a, b) => (getDate(a) ?? 0) - (getDate(b) ?? 0))