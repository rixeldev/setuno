import { maxScrollOffset } from "@/libs/autoscroll"

/**
 * Pure helpers for the per-song reading state (roadmap #4). They keep the
 * values the reader restores inside the bounds the security rules accept and
 * never touch a Firebase SDK, so `tests/unit/readerState.test.ts` can import
 * them directly.
 */

/** Transposition the reader may apply, in semitones (one octave either way). */
export const READER_SEMITONES_LIMIT = 11
/** Highest capo the reader may set (mirrors the reader controls). */
export const READER_MAX_CAPO = 12
/** Text-size range of the reader, in points (mirrors the reader controls). */
export const READER_FONT_MIN = 13
export const READER_FONT_MAX = 30
/** Positions are quantized to 2% steps (see `scrollRatioFor`). */
export const SCROLL_RATIO_STEPS = 50
/** Below this, a saved position is "the top" and there is nothing to resume. */
export const RESUME_MIN_RATIO = 1 / SCROLL_RATIO_STEPS

/** 0..1 of the scrollable range; anything unknown reads as the top. */
export const clampScrollRatio = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

/** Keeps the transposition on a whole semitone inside one octave. */
export const clampReaderSemitones = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(-READER_SEMITONES_LIMIT, Math.min(READER_SEMITONES_LIMIT, Math.round(value)))
}

/** Keeps the capo on a fret between 0 and 12. */
export const clampReaderCapo = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(READER_MAX_CAPO, Math.round(value)))
}

/** Keeps the text size on a whole point inside the reader's range. */
export const clampReaderFontSize = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return READER_FONT_MIN
  return Math.max(READER_FONT_MIN, Math.min(READER_FONT_MAX, Math.round(value)))
}

/**
 * Text size for an in-progress pinch (roadmap #5): the start size scaled by how
 * far the fingers travelled since the gesture began, snapped to a whole point.
 */
export const pinchFontSize = (
  startSize: number,
  startDistance: number,
  distance: number,
): number => {
  if (startDistance <= 0 || !Number.isFinite(distance)) return clampReaderFontSize(startSize)
  return clampReaderFontSize(startSize * (distance / startDistance))
}

/**
 * Scroll offset that puts the reader back at `ratio` of the range. Quantizing
 * to 2% steps keeps the whole thing cheap to store: a write per scroll frame
 * would be wasteful, and a verse is far wider than 2% of a song.
 */
export const scrollRatioFor = (
  offset: number,
  contentHeight: number,
  viewportHeight: number,
): number => {
  const limit = maxScrollOffset(contentHeight, viewportHeight)
  if (limit <= 0 || !Number.isFinite(offset)) return 0
  const ratio = clampScrollRatio(offset / limit)
  return Math.round(ratio * SCROLL_RATIO_STEPS) / SCROLL_RATIO_STEPS
}

/** Inverse of `scrollRatioFor`: the offset to scroll back to on open. */
export const scrollOffsetForRatio = (
  ratio: unknown,
  contentHeight: number,
  viewportHeight: number,
): number =>
  Math.round(clampScrollRatio(ratio) * maxScrollOffset(contentHeight, viewportHeight))

/** True when a saved position is worth restoring (a real jump, not the top). */
export const hasResumePoint = (ratio: unknown): boolean =>
  clampScrollRatio(ratio) >= RESUME_MIN_RATIO
