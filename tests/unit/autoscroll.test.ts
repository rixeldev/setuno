import { describe, expect, it } from "vitest"

import {
  AUTOSCROLL_DEFAULT_DELAY,
  AUTOSCROLL_DEFAULT_SPEED,
  AUTOSCROLL_DELAYS,
  AUTOSCROLL_MAX_SPEED,
  AUTOSCROLL_MIN_SPEED,
  autoscrollPixelsPerSecond,
  autoscrollStatusText,
  clampAutoscrollDelay,
  clampAutoscrollSpeed,
  formatAutoscrollClock,
  lyricRowHeight,
  maxScrollOffset,
  nextAutoscrollDelay,
  remainingAutoscrollSeconds,
  scrollProgress,
} from "@/libs/autoscroll"

describe("clampAutoscrollSpeed", () => {
  it("snaps onto the allowed step inside the range", () => {
    expect(clampAutoscrollSpeed(13)).toBe(14)
    expect(clampAutoscrollSpeed(0)).toBe(AUTOSCROLL_MIN_SPEED)
    expect(clampAutoscrollSpeed(1000)).toBe(AUTOSCROLL_MAX_SPEED)
    expect(clampAutoscrollSpeed(-4)).toBe(AUTOSCROLL_MIN_SPEED)
  })

  it("falls back to the default for non-numeric input", () => {
    expect(clampAutoscrollSpeed(Number.NaN)).toBe(AUTOSCROLL_DEFAULT_SPEED)
    expect(clampAutoscrollSpeed(Number.POSITIVE_INFINITY)).toBe(AUTOSCROLL_DEFAULT_SPEED)
  })
})

describe("autoscroll delays", () => {
  it("offers the default among the options", () => {
    expect(AUTOSCROLL_DELAYS).toContain(AUTOSCROLL_DEFAULT_DELAY)
  })

  it("snaps an unknown delay onto the closest option", () => {
    expect(clampAutoscrollDelay(4)).toBe(5)
    expect(clampAutoscrollDelay(0.4)).toBe(0)
    expect(clampAutoscrollDelay(Number.NaN)).toBe(AUTOSCROLL_DEFAULT_DELAY)
    expect(clampAutoscrollDelay(9999)).toBe(15)
  })

  it("cycles through the options and wraps around", () => {
    expect(nextAutoscrollDelay(0)).toBe(3)
    expect(nextAutoscrollDelay(3)).toBe(5)
    expect(nextAutoscrollDelay(15)).toBe(0)
  })
})

describe("autoscroll geometry", () => {
  it("converts a speed into pixels per second", () => {
    // 60 lines per minute at 16 px font: one 26 px row per second.
    expect(lyricRowHeight(16)).toBe(26)
    expect(autoscrollPixelsPerSecond(60, 16)).toBeCloseTo(26)
    expect(autoscrollPixelsPerSecond(12, 20)).toBeCloseTo((12 / 60) * lyricRowHeight(20))
  })

  it("never reports a negative scroll range", () => {
    expect(maxScrollOffset(2000, 800)).toBe(1200)
    expect(maxScrollOffset(400, 800)).toBe(0)
  })

  it("reports the travelled share of the range", () => {
    // A song that fits on screen is already at the end.
    expect(scrollProgress(100, 400, 800)).toBe(1)
    expect(scrollProgress(0, 2000, 800)).toBe(0)
    expect(scrollProgress(600, 2000, 800)).toBe(0.5)
    expect(scrollProgress(99999, 2000, 800)).toBe(1)
  })

  it("estimates the time left at the current speed", () => {
    // 60 lines/min, 16 px font → 26 px/s; 1200 px of range left → 46 s.
    expect(remainingAutoscrollSeconds(0, 2000, 800, 60, 16)).toBeCloseTo(1200 / 26)
    expect(remainingAutoscrollSeconds(1200, 2000, 800, 60, 16)).toBe(0)
    expect(remainingAutoscrollSeconds(0, 400, 800, 60, 16)).toBe(0)
  })
})

describe("formatAutoscrollClock", () => {
  it("formats a remaining-time clock", () => {
    expect(formatAutoscrollClock(0)).toBe("0:00")
    expect(formatAutoscrollClock(65)).toBe("1:05")
    expect(formatAutoscrollClock(600)).toBe("10:00")
    expect(formatAutoscrollClock(24.6)).toBe("0:25")
  })

  it("returns an empty string when the time is unknown", () => {
    expect(formatAutoscrollClock(null)).toBe("")
    expect(formatAutoscrollClock(Number.NaN)).toBe("")
  })
})

describe("autoscrollStatusText", () => {
  // The reader's collapsed tray and the full bar share this, so both say the
  // same words; the stub keeps the assertions about the keys, not the copy.
  const t = (key: string, options?: Record<string, string | number>): string =>
    options
      ? `${key}(${Object.entries(options)
          .map(([name, value]) => `${name}=${value}`)
          .join(",")})`
      : key

  it("leads with the start countdown while waiting", () => {
    expect(autoscrollStatusText("waiting", 3, null, t)).toBe(
      "songs.autoscrollStarting(seconds=3)",
    )
  })

  it("says so when the transport is paused or finished", () => {
    expect(autoscrollStatusText("paused", 0, 12, t)).toBe("songs.autoscrollPaused")
    expect(autoscrollStatusText("done", 0, 0, t)).toBe("songs.autoscrollDone")
  })

  it("reports the time left while it scrolls", () => {
    expect(autoscrollStatusText("playing", 0, 65, t)).toBe(
      "songs.autoscrollRemaining(time=1:05)",
    )
    expect(autoscrollStatusText("playing", 0, 0, t)).toBe(
      "songs.autoscrollRemaining(time=0:00)",
    )
  })

  it("has nothing to say when the time is unknown or it has not started", () => {
    expect(autoscrollStatusText("playing", 0, null, t)).toBeNull()
    expect(autoscrollStatusText("idle", 0, null, t)).toBeNull()
  })
})
