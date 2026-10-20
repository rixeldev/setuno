import { describe, expect, it } from "vitest"

import {
  EMPTY_REVIEW_STATE,
  registerShowRead,
  REVIEW_ASK_WINDOW_MS,
  REVIEW_MAX_ASKS_PER_WINDOW,
  REVIEW_MILESTONE_READS,
  REVIEW_MIN_GAP_MS,
  sanitizeReviewState,
  shouldRequestReview,
  SHOW_READ_QUIET_MS,
  withAskRecorded,
  type ReviewState,
} from "@/libs/reviewPrompt"

const DAY_MS = 86_400_000

/** Past the milestone with no prompt yet — the eligible baseline. */
const seasoned = (patch: Partial<ReviewState> = {}): ReviewState => ({
  showReads: REVIEW_MILESTONE_READS,
  lastReadAt: 1_000,
  askedAt: [],
  ...patch,
})

describe("sanitizeReviewState", () => {
  it("reads anything unusable as a fresh ledger", () => {
    expect(sanitizeReviewState(null)).toEqual(EMPTY_REVIEW_STATE)
    expect(sanitizeReviewState("ledger")).toEqual(EMPTY_REVIEW_STATE)
    expect(sanitizeReviewState(42)).toEqual(EMPTY_REVIEW_STATE)
    expect(sanitizeReviewState([])).toEqual(EMPTY_REVIEW_STATE)
    expect(sanitizeReviewState({ showReads: "3", lastReadAt: {}, askedAt: "lots" })).toEqual(
      EMPTY_REVIEW_STATE,
    )
    expect(sanitizeReviewState({ showReads: -2, lastReadAt: -9, askedAt: [null, true] })).toEqual(
      EMPTY_REVIEW_STATE,
    )
  })

  it("keeps the honest numbers and heals the rest", () => {
    expect(
      sanitizeReviewState({
        showReads: 3.9,
        lastReadAt: 1_000.5,
        askedAt: [10, "x", Number.NaN, -5, 10, 1e15],
      }),
    ).toEqual({ showReads: 3, lastReadAt: 1_000, askedAt: [10, 1e15] })
  })
})

describe("registerShowRead", () => {
  const t0 = 10_000_000

  it("counts the first read of an occasion and only slides the window inside the burst", () => {
    const first = registerShowRead(EMPTY_REVIEW_STATE, t0)
    expect(first.showReads).toBe(1)

    const second = registerShowRead(first, t0 + 25 * 60_000)
    expect(second.showReads).toBe(1)
    expect(second.lastReadAt).toBe(t0 + 25 * 60_000)

    // Every step stays inside the previous one's quiet window: a marathon
    // setlist is still ONE occasion, not one per song.
    const marathon = registerShowRead(second, t0 + 50 * 60_000)
    expect(marathon.showReads).toBe(1)
    expect(marathon.lastReadAt).toBe(t0 + 50 * 60_000)
  })

  it("opens a new occasion after 30 quiet minutes, boundary included", () => {
    const open = registerShowRead(EMPTY_REVIEW_STATE, t0)
    expect(registerShowRead(open, t0 + SHOW_READ_QUIET_MS - 1).showReads).toBe(1)
    expect(registerShowRead(open, t0 + SHOW_READ_QUIET_MS).showReads).toBe(2)
  })

  it("never mutates the input state", () => {
    const state = seasoned({ showReads: 1, lastReadAt: 5_000 })
    const snapshot = { ...state, askedAt: [...state.askedAt] }
    registerShowRead(state, 6_000)
    expect(state).toEqual(snapshot)
  })
})

describe("shouldRequestReview", () => {
  const now = 400 * DAY_MS

  it("asks from the third show read on, never before", () => {
    expect(REVIEW_MILESTONE_READS).toBe(3)
    expect(shouldRequestReview(seasoned({ showReads: REVIEW_MILESTONE_READS - 1 }), now)).toBe(false)
    expect(shouldRequestReview(seasoned(), now)).toBe(true)
  })

  it("rests 90 days between prompts, boundary included", () => {
    expect(shouldRequestReview(seasoned({ askedAt: [now - REVIEW_MIN_GAP_MS + 1] }), now)).toBe(false)
    expect(shouldRequestReview(seasoned({ askedAt: [now - REVIEW_MIN_GAP_MS] }), now)).toBe(true)
  })

  it("never exceeds three prompts per rolling year", () => {
    const capped = seasoned({ askedAt: [now - 100 * DAY_MS, now - 95 * DAY_MS, now - 91 * DAY_MS] })
    expect(shouldRequestReview(capped, now)).toBe(false)
    expect(REVIEW_MAX_ASKS_PER_WINDOW).toBe(3)

    // The oldest ask ages out of the rolling window: budget back to two and
    // the resting gap still satisfied.
    const aged = seasoned({
      askedAt: [now - 370 * DAY_MS, now - 100 * DAY_MS, now - 95 * DAY_MS],
    })
    expect(shouldRequestReview(aged, now)).toBe(true)
    expect(REVIEW_ASK_WINDOW_MS).toBe(365 * DAY_MS)
  })

  it("lets a shifted clock delay the prompt but never buy extra asks", () => {
    expect(shouldRequestReview(seasoned({ askedAt: [now + 10 * DAY_MS] }), now)).toBe(true)
    // The future stamp counts toward neither rule: three real asks still cap.
    const skewed = seasoned({
      askedAt: [now + 10 * DAY_MS, now - 10 * DAY_MS, now - 20 * DAY_MS, now - 30 * DAY_MS],
    })
    expect(shouldRequestReview(skewed, now)).toBe(false)
  })
})

describe("withAskRecorded", () => {
  it("appends the ask without touching the milestone and round-trips", () => {
    const asked = withAskRecorded(seasoned({ askedAt: [5] }), 9)
    expect(asked).toEqual({ showReads: 3, lastReadAt: 1_000, askedAt: [5, 9] })
    expect(sanitizeReviewState(asked)).toEqual(asked)
  })
})
