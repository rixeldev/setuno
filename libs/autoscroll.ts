/**
 * Autoscroll maths for the song reader (roadmap #1).
 *
 * Speed is expressed in **lyric lines per minute**, which is what a musician
 * actually reasons about ("this verse takes about a minute"), and converted to
 * pixels with the row height of the current font size. Everything here is pure
 * so the maths stays unit-tested; the animation itself lives in
 * `hooks/useAutoscroll.ts`.
 */

export const AUTOSCROLL_MIN_SPEED = 2
export const AUTOSCROLL_MAX_SPEED = 60
export const AUTOSCROLL_SPEED_STEP = 2
export const AUTOSCROLL_DEFAULT_SPEED = 12

/** Start-delay options, in seconds. `0` starts moving straight away. */
export const AUTOSCROLL_DELAYS = [0, 3, 5, 10, 15] as const
export const AUTOSCROLL_DEFAULT_DELAY = 5

/** Where the transport currently is. */
export type AutoscrollStatus = "idle" | "waiting" | "playing" | "paused" | "done"

export type AutoscrollDelay = (typeof AUTOSCROLL_DELAYS)[number]

/** Snaps a speed onto the allowed range and step. */
export const clampAutoscrollSpeed = (value: number): number => {
  if (!Number.isFinite(value)) return AUTOSCROLL_DEFAULT_SPEED
  const snapped = Math.round(value / AUTOSCROLL_SPEED_STEP) * AUTOSCROLL_SPEED_STEP
  return Math.max(AUTOSCROLL_MIN_SPEED, Math.min(AUTOSCROLL_MAX_SPEED, snapped))
}

/** Nearest allowed delay; anything unknown falls back to the default. */
export const clampAutoscrollDelay = (value: number): AutoscrollDelay => {
  if (!Number.isFinite(value)) return AUTOSCROLL_DEFAULT_DELAY
  return AUTOSCROLL_DELAYS.reduce<AutoscrollDelay>(
    (best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best),
    AUTOSCROLL_DEFAULT_DELAY,
  )
}

/** Next delay when the reader taps the chip: the options cycle in order. */
export const nextAutoscrollDelay = (current: number): AutoscrollDelay => {
  const index = AUTOSCROLL_DELAYS.indexOf(clampAutoscrollDelay(current))
  return AUTOSCROLL_DELAYS[(index + 1) % AUTOSCROLL_DELAYS.length] ?? AUTOSCROLL_DEFAULT_DELAY
}

/**
 * Height of one reader row at a font size. The lyric grid draws a chord row
 * above every line, so this is deliberately a little taller than the bare font.
 */
export const lyricRowHeight = (fontSize: number): number => Math.round(fontSize * 1.6)

/** Pixels to travel per second at a given speed and font size. */
export const autoscrollPixelsPerSecond = (speed: number, fontSize: number): number =>
  (clampAutoscrollSpeed(speed) / 60) * lyricRowHeight(fontSize)

/** How far the content can scroll; never negative, so it is safe to divide. */
export const maxScrollOffset = (contentHeight: number, viewportHeight: number): number =>
  Math.max(0, Math.round(contentHeight - viewportHeight))

/** 0..1 of the scrollable range already travelled (1 when nothing can scroll). */
export const scrollProgress = (
  offset: number,
  contentHeight: number,
  viewportHeight: number,
): number => {
  const limit = maxScrollOffset(contentHeight, viewportHeight)
  if (limit <= 0) return 1
  return Math.max(0, Math.min(1, offset / limit))
}

/** Seconds left to reach the bottom at the current speed (`null`: unknown). */
export const remainingAutoscrollSeconds = (
  offset: number,
  contentHeight: number,
  viewportHeight: number,
  speed: number,
  fontSize: number,
): number | null => {
  const rate = autoscrollPixelsPerSecond(speed, fontSize)
  if (rate <= 0) return null
  const left = maxScrollOffset(contentHeight, viewportHeight) - Math.max(0, offset)
  return Math.max(0, left) / rate
}

/** `1:05` clock for the remaining-time readout (`0:00` at the end). */
export const formatAutoscrollClock = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return ""
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  return `${minutes}:${`${total % 60}`.padStart(2, "0")}`
}

/**
 * The transport's one-line readout — start countdown, pause, done or the time
 * left, and `null` while there is nothing to say. Shared by the full bar and
 * the reader's collapsed tray so the two can never disagree about what the
 * transport is doing.
 */
export const autoscrollStatusText = (
  status: AutoscrollStatus,
  countdown: number,
  remainingSeconds: number | null,
  t: (key: string, options?: Record<string, string | number>) => string,
): string | null => {
  if (status === "waiting") return t("songs.autoscrollStarting", { seconds: countdown })
  if (status === "paused") return t("songs.autoscrollPaused")
  if (status === "done") return t("songs.autoscrollDone")
  if (remainingSeconds !== null) {
    return t("songs.autoscrollRemaining", { time: formatAutoscrollClock(remainingSeconds) })
  }
  return null
}
