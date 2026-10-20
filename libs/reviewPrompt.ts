/**
 * In-app review at the right moment (roadmap #71): the milestone, the store
 * quotas and the occasion's shape as pure maths, so every decision here is
 * unit-tested without a device, a store account or a live clock.
 *
 * A "show read" is a *burst*: stepping through a setlist mounts the reader
 * once per song, so occasions are grouped by a quiet window — the first read
 * after `SHOW_READ_QUIET_MS` opens one and every read inside the window
 * slides it (one rehearsal = one occasion; a StrictMode double-mount = one
 * too, since the two effects land milliseconds apart).
 *
 * The ledger mirrors Apple's own contract — at most
 * `REVIEW_MAX_ASKS_PER_WINDOW` prompts per rolling `REVIEW_ASK_WINDOW_MS`,
 * which the OS also enforces — plus a `REVIEW_MIN_GAP_MS` rest between asks:
 * a prompt the user resents costs exactly the goodwill the milestone is
 * asking on, so both sides throttle.
 */

const DAY_MS = 86_400_000

/** Ask from the third show read on — the roadmap's happy milestone. */
export const REVIEW_MILESTONE_READS = 3
/** Reads closer together than this are the same occasion (stepping a setlist). */
export const SHOW_READ_QUIET_MS = 30 * 60 * 1_000
/** Never ask twice within 90 days. */
export const REVIEW_MIN_GAP_MS = 90 * DAY_MS
/** Rolling window the prompt budget is counted over (Apple allows 3 per year). */
export const REVIEW_ASK_WINDOW_MS = 365 * DAY_MS
/** Hard cap of prompts inside that window, mirroring the store's quota. */
export const REVIEW_MAX_ASKS_PER_WINDOW = 3
/**
 * How long after the reader is left the prompt may appear: the stack
 * animation has long settled by then, so the dialog never races navigation
 * (Apple's guideline: never while the user is doing something time
 * sensitive).
 */
export const REVIEW_PROMPT_DELAY_MS = 1_500

export interface ReviewState {
  /** Show reads counted so far — what the milestone is measured against. */
  showReads: number
  /** When the current burst last saw a read — the quiet window's anchor. */
  lastReadAt: number | null
  /** Every prompt this device asked for (the quota ledger, oldest first). */
  askedAt: number[]
}

export const EMPTY_REVIEW_STATE: ReviewState = {
  showReads: 0,
  lastReadAt: null,
  askedAt: [],
}

const asCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0

const asStamp = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null

/**
 * Rebuilds the ledger from untrusted JSON (the `sanitizeSongbook`
 * precedent): anything unreadable self-heals to a fresh state instead of
 * silently blocking the prompt forever — or letting garbage skip the quota.
 */
export const sanitizeReviewState = (raw: unknown): ReviewState => {
  if (typeof raw !== "object" || raw === null) return EMPTY_REVIEW_STATE
  const data = raw as Record<string, unknown>
  const asked = Array.isArray(data.askedAt) ? data.askedAt : []
  return {
    showReads: asCount(data.showReads),
    lastReadAt: asStamp(data.lastReadAt),
    askedAt: Array.from(
      new Set(asked.map(asStamp).filter((stamp): stamp is number => stamp !== null)),
    ),
  }
}

/**
 * Records a setlist read: the first read of a quiet burst opens a new
 * occasion and grows the milestone count, reads inside the burst only slide
 * the window forward. Never mutates the input.
 */
export const registerShowRead = (state: ReviewState, now: number): ReviewState => {
  const previous = state.lastReadAt
  const opensOccasion = previous === null || now - previous >= SHOW_READ_QUIET_MS
  return {
    ...state,
    showReads: state.showReads + (opensOccasion ? 1 : 0),
    lastReadAt: now,
  }
}

/**
 * The whole decision: milestone reached, the rolling-year budget still has
 * room and the last ask is `REVIEW_MIN_GAP_MS` old. Timestamps in the future
 * (a clock that jumped backwards) count toward neither rule — a skewed clock
 * may delay a prompt but can never buy extra asks.
 */
export const shouldRequestReview = (state: ReviewState, now: number): boolean => {
  if (state.showReads < REVIEW_MILESTONE_READS) return false
  const asked = state.askedAt.filter((stamp) => stamp <= now && now - stamp < REVIEW_ASK_WINDOW_MS)
  if (asked.length >= REVIEW_MAX_ASKS_PER_WINDOW) return false
  if (asked.length === 0) return true
  return now - Math.max(...asked) >= REVIEW_MIN_GAP_MS
}

/** Appends a successful prompt to the ledger (newest last). */
export const withAskRecorded = (state: ReviewState, now: number): ReviewState => ({
  ...state,
  askedAt: [...state.askedAt, now],
})
