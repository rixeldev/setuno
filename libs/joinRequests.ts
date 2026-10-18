import type { JoinRequestStatus } from "@/interfaces"

/** Every state an ask can be in (roadmap #60). */
export const JOIN_REQUEST_STATUSES: readonly JoinRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
]

/** The band's name in the opt-in directory, clamped like the rules pin it. */
export const DIRECTORY_NAME_MAX = 80

/** The optional note a requester adds, clamped like the rules pin it. */
export const JOIN_REQUEST_NOTE_MAX = 200

/**
 * Stored statuses arrive from untrusted documents, so anything unrecognised
 * reads back as `pending` — invalid stored data self-heals on read, exactly
 * like `normalizeSongStatus` (roadmap #30).
 */
export const normalizeJoinRequestStatus = (value: unknown): JoinRequestStatus =>
  value === "approved" || value === "rejected" ? value : "pending"

/**
 * How a band name enters the opt-in directory (roadmap #60): trimmed,
 * internal whitespace collapsed and lowercased into the `nameKey` the search
 * matches exactly. The display name keeps its casing, both sides clamp to what
 * the rules allow, and `null` means "nothing to publish".
 */
export const directoryName = (name: string): { name: string; nameKey: string } | null => {
  const collapsed = name.trim().replace(/\s+/g, " ")
  if (collapsed.length === 0) return null
  return {
    name: collapsed.slice(0, DIRECTORY_NAME_MAX),
    nameKey: collapsed.toLowerCase().slice(0, DIRECTORY_NAME_MAX),
  }
}

/** The exact-match key a search runs against (the same normalization as above). */
export const directoryNameKey = (name: string): string | null =>
  directoryName(name)?.nameKey ?? null

/**
 * The optional note, trimmed and clamped to the size the rules pin — and never
 * ending a cut inside an emoji (the comment clamp's precedent, roadmap #55).
 */
export const joinRequestNote = (note: string): string => {
  const sliced = note.trim().slice(0, JOIN_REQUEST_NOTE_MAX)
  return /[\uD800-\uDBFF]$/.test(sliced) ? sliced.slice(0, -1) : sliced
}
