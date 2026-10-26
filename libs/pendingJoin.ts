/**
 * The invitation link a signed-out visitor arrived with (roadmap #89). Pure —
 * no React Native imports, so it unit tests in node.
 *
 * Somebody taps a link, the app has no session yet, and the link must survive
 * the sign-in or sign-up that follows: the token is parked on the device and
 * redeemed once, on the first screen that can write a membership. It expires
 * after a month — a link nobody acted on for that long is stale, and the band's
 * own link has likely been revoked by then anyway.
 */

import { isInviteToken } from "@/functions/src/inviteLinks"

/** One entry, one install: the pending token is a device concern, not a profile one. */
export const PENDING_JOIN_KEY = "setuno:pending-join:v1"

/** How long a parked token stays worth redeeming. */
export const PENDING_JOIN_TTL_MS = 30 * 86_400_000

/** A clock that jumped further than this into the future is not trusted. */
const CLOCK_SKEW_MS = 86_400_000

export interface PendingJoin {
  token: string
  /** When it was parked (epoch ms) — client time, exactly like every other local stamp. */
  savedAt: number
}

/**
 * Rebuilds a stored entry from untrusted JSON. Anything unusable — the wrong
 * shape, a token that could escape a document path, a stamp from the future or
 * one older than the window — reads as "nothing pending", so a corrupt entry
 * can never fire a redemption nobody asked for.
 */
export const sanitizePendingJoin = (raw: unknown, nowMs: number): PendingJoin | null => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const token = record.token
  const savedAt = record.savedAt
  if (!isInviteToken(token)) return null
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null
  if (savedAt <= 0 || savedAt > nowMs + CLOCK_SKEW_MS) return null
  if (nowMs - savedAt > PENDING_JOIN_TTL_MS) return null
  return { token, savedAt: Math.trunc(savedAt) }
}

/** The same recovery applied to the raw AsyncStorage string. */
export const pendingJoinFromJson = (json: string | null, nowMs: number): PendingJoin | null => {
  if (!json) return null
  try {
    return sanitizePendingJoin(JSON.parse(json), nowMs)
  } catch {
    // Not JSON (or not ours): treat it as nothing pending.
    return null
  }
}
