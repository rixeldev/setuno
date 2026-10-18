import type { SongPresence } from "@/interfaces"

/** How often an open editor refreshes its own dot. */
export const PRESENCE_HEARTBEAT_MS = 30_000

/**
 * A dot counts as live for two and a half missed heartbeats: a killed app
 * goes dark on its own, so nothing ever has to clean up after a crash — the
 * notice just stops mentioning them (roadmap #28's soft warning, never a lock).
 */
export const PRESENCE_TTL_MS = 75_000

/**
 * How often the notice re-checks freshness. The flip belongs on a timer in an
 * effect — never `Date.now()` in render (the React Compiler purity rule).
 */
export const PRESENCE_TICK_MS = 15_000

/**
 * The rules pin the display name to 1..80 characters; trim and collapse runs
 * of whitespace so a queued write can never smuggle padding, and keep the
 * band's own casing (this is a name, not a search key).
 */
export const presenceName = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const name = value.trim().replace(/\s+/g, " ").slice(0, 80)
  return name.length > 0 ? name : null
}

/**
 * Read one presence document defensively: the id must be the editor it
 * claims, and the stamp a real time — anything else heals by disappearing
 * (the mapper precedent), so a corrupt dot can never warn about a ghost.
 * Accepts a plain `Date` (offline cache) or a Firestore `Timestamp`.
 */
export const mapPresence = (docId: string, data: unknown): SongPresence | null => {
  if (typeof data !== "object" || data === null) return null
  const record = data as Record<string, unknown>
  if (typeof record.uid !== "string" || record.uid !== docId) return null
  const displayName = presenceName(record.displayName)
  if (displayName === null) return null
  const raw = record.updatedAt
  let updatedAt: Date | null = null
  if (raw instanceof Date) {
    updatedAt = raw
  } else if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { toDate?: unknown }).toDate === "function"
  ) {
    updatedAt = (raw as { toDate: () => Date }).toDate()
  }
  if (updatedAt === null || Number.isNaN(updatedAt.getTime())) return null
  return { uid: docId, displayName, updatedAt }
}

/**
 * Fresh within the TTL. A heartbeat from the future (clock skew) is fresh
 * too: never hide a live editor over a fast device clock.
 */
export const isPresenceFresh = (presence: SongPresence, now: number): boolean =>
  now - presence.updatedAt.getTime() <= PRESENCE_TTL_MS

/**
 * What the notice shows: everybody but the caller, still inside the window,
 * sorted by name so the line cannot shuffle between heartbeats (the uid
 * breaks the tie deterministically).
 */
export const liveEditors = (
  docs: readonly SongPresence[],
  myUid: string | null,
  now: number,
): SongPresence[] =>
  docs
    .filter((entry) => entry.uid !== myUid && isPresenceFresh(entry, now))
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }) ||
        a.uid.localeCompare(b.uid),
    )
