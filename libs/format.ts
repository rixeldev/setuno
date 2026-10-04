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

/** "Today · 9:00 PM" style relative labels used in agendas. */
export const formatRelativeDay = (date: Date | null | undefined): string => {
  if (!date) return "—"
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays === -1) return "Yesterday"
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

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ?? "").toUpperCase())
    .join("")

export const sortByDateDesc = <T>(items: T[], getDate: (item: T) => number | null): T[] =>
  [...items].sort((a, b) => (getDate(b) ?? 0) - (getDate(a) ?? 0))

export const sortByDateAsc = <T>(items: T[], getDate: (item: T) => number | null): T[] =>
  [...items].sort((a, b) => (getDate(a) ?? 0) - (getDate(b) ?? 0))