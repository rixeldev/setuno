import AsyncStorage from "@react-native-async-storage/async-storage"
import * as StoreReview from "expo-store-review"

import {
  EMPTY_REVIEW_STATE,
  registerShowRead,
  REVIEW_PROMPT_DELAY_MS,
  sanitizeReviewState,
  shouldRequestReview,
  withAskRecorded,
  type ReviewState,
} from "@/libs/reviewPrompt"

/**
 * The prompt half of roadmap #71: it owns the ledger (one local AsyncStorage
 * entry like every display preference — nothing here is account data) and the
 * timing, so the reader only pairs `beginShowRead`/`endShowRead` around a
 * setlist read. The ask is scheduled *after* the reader is left and a beat of
 * quiet, fires fire-and-forget behind the store's own availability check, and
 * a declined request records nothing — the store's quota, not a blind
 * counter, is what decides the retry.
 */
const STORAGE_KEY = "setuno:review-prompt:v1"

/** Setlist reads currently on screen — the replace swap mounts in either order. */
let activeReads = 0
let pendingAsk: ReturnType<typeof setTimeout> | null = null

const loadState = async (): Promise<ReviewState> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_REVIEW_STATE
    const parsed: unknown = JSON.parse(raw)
    return sanitizeReviewState(parsed)
  } catch {
    // A corrupted ledger must never block reading: start over from zero.
    return EMPTY_REVIEW_STATE
  }
}

const saveState = (state: ReviewState): void => {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined)
}

const cancelPendingAsk = (): void => {
  if (pendingAsk !== null) {
    clearTimeout(pendingAsk)
    pendingAsk = null
  }
}

const maybeRequestReview = async (): Promise<void> => {
  try {
    const state = await loadState()
    const now = Date.now()
    if (!shouldRequestReview(state, now)) return
    // Web, TestFlight and Android < 5 answer false: no dialog, no quota spent.
    if (!(await StoreReview.isAvailableAsync())) return
    await StoreReview.requestReview()
    saveState(withAskRecorded(state, now))
  } catch {
    // The store refused (its quota, no store account, a cold native module):
    // record nothing, so the next eligible session simply offers again.
  }
}

/**
 * Opens a show-read occasion: every setlist read the reader mounts calls
 * this, and only the first read of a quiet burst grows the milestone count.
 * Any prompt the previous session had scheduled dies here — the dialog belongs
 * after a *finished* read, never over a fresh one.
 */
export const beginShowRead = (): void => {
  cancelPendingAsk()
  activeReads += 1
  void loadState()
    .then((state) => saveState(registerShowRead(state, Date.now())))
    .catch(() => undefined)
}

/**
 * Closes a show read. When the last reader leaves — never while a song step
 * still keeps one on screen — the prompt is scheduled a beat later, so it can
 * never interrupt reading or navigation. Fire-and-forget by design: an
 * unavailable store or a full quota simply resolves to silence.
 */
export const endShowRead = (): void => {
  activeReads = Math.max(0, activeReads - 1)
  if (activeReads > 0) return
  cancelPendingAsk()
  pendingAsk = setTimeout(() => {
    pendingAsk = null
    void maybeRequestReview()
  }, REVIEW_PROMPT_DELAY_MS)
}
