import type { DeviceSession } from "@/interfaces"

/**
 * Device sessions (roadmap #69): the pure core behind the settings screen's
 * "Devices & sessions" list. The data is `users/{uid}/devices` — #52's push
 * registrations — so the map/sort/label maths lives here, unit-tested, and
 * the screen only renders it.
 *
 * The freshness flip rides a tick (the `#28` pattern): every function below
 * takes `now` as an argument, so nothing ever calls `Date.now()` during
 * render (the React Compiler purity rule).
 */

/** How often the screen re-derives its "last seen" captions. */
export const DEVICE_LIST_TICK_MS = 60_000

/** Under a minute: "just now" beats "0 min ago". */
const JUST_NOW_MS = 60_000
const MINUTE_MS = 60_000
/** Hours are shown for up to two days, days for up to a month. */
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const HOURS_LIMIT_MS = 2 * DAY_MS
const DAYS_LIMIT_MS = 30 * DAY_MS

type Translate = (key: string, options?: Record<string, string | number>) => string

/**
 * Read one device document defensively. The id *is* the token (#52 pins
 * `token == deviceId` in the rules), so the body's copy of it is never read —
 * a drifted token cannot point the row at another device. A row whose stamp
 * is unreadable **and** whose platform is unrecognised heals by disappearing
 * (the mapper precedent): it carries nothing the list could honestly show.
 */
export const mapDeviceSession = (docId: string, data: unknown): DeviceSession | null => {
  if (docId.length === 0 || typeof data !== "object" || data === null) return null
  const record = data as Record<string, unknown>
  const platform: DeviceSession["platform"] =
    record.platform === "android" || record.platform === "ios" ? record.platform : "unknown"
  // Accept a plain `Date` (offline cache) or a Firestore `Timestamp` — the
  // `mapPresence` stamp extraction, kept in step with it.
  const raw = record.lastSeenAt
  let lastSeenAt: Date | null = null
  if (raw instanceof Date) {
    lastSeenAt = raw
  } else if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { toDate?: unknown }).toDate === "function"
  ) {
    lastSeenAt = (raw as { toDate: () => Date }).toDate()
  }
  if (lastSeenAt !== null && Number.isNaN(lastSeenAt.getTime())) lastSeenAt = null
  if (lastSeenAt === null && platform === "unknown") return null
  return { token: docId, platform, lastSeenAt }
}

/**
 * Most recently seen first, unreadable stamps last, the token breaking ties
 * so every device derives the same order. Returns a new array — the list is
 * shared state (the songbookSort law).
 */
export const sortDevices = (devices: readonly DeviceSession[]): DeviceSession[] =>
  [...devices].sort((a, b) => {
    const left = a.lastSeenAt === null ? Number.NEGATIVE_INFINITY : a.lastSeenAt.getTime()
    const right = b.lastSeenAt === null ? Number.NEGATIVE_INFINITY : b.lastSeenAt.getTime()
    return right - left || a.token.localeCompare(b.token)
  })

/** Brand names never translate; anything else collapses to one honest word. */
export const platformLabel = (t: Translate, platform: DeviceSession["platform"]): string =>
  platform === "android" ? "Android" : platform === "ios" ? "iOS" : t("devices.otherDevice")

/**
 * The relative caption: compact number forms on purpose — `{{n}} min ago`
 * reads correctly for 1 where an English plural would not, and Spanish keeps
 * the same shape. A stamp from the future (fast clock) counts as *now*;
 * `null` answers `null` so the screen can choose its own wording.
 */
export const lastSeenLabel = (
  t: Translate,
  stamp: Date | null,
  nowMs: number,
): string | null => {
  if (stamp === null) return null
  const age = Math.max(0, nowMs - stamp.getTime())
  if (age < JUST_NOW_MS) return t("devices.justNow")
  if (age < HOUR_MS) return t("devices.minutesAgo", { n: Math.floor(age / MINUTE_MS) })
  if (age < HOURS_LIMIT_MS) return t("devices.hoursAgo", { n: Math.floor(age / HOUR_MS) })
  if (age < DAYS_LIMIT_MS) return t("devices.daysAgo", { n: Math.floor(age / DAY_MS) })
  return t("devices.overMonth")
}
