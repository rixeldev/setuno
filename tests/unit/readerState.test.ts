import { describe, expect, it } from "vitest"

import {
  READER_FONT_MAX,
  READER_FONT_MIN,
  READER_MAX_CAPO,
  READER_SEMITONES_LIMIT,
  clampReaderCapo,
  clampReaderFontSize,
  clampReaderSemitones,
  clampScrollRatio,
  hasResumePoint,
  pinchFontSize,
  scrollOffsetForRatio,
  scrollRatioFor,
} from "@/libs/readerState"

describe("clampScrollRatio", () => {
  it("keeps the ratio inside the scrollable range", () => {
    expect(clampScrollRatio(0.5)).toBe(0.5)
    expect(clampScrollRatio(-2)).toBe(0)
    expect(clampScrollRatio(3)).toBe(1)
  })

  it("falls back to the top for non-numeric input", () => {
    expect(clampScrollRatio(undefined)).toBe(0)
    expect(clampScrollRatio("half")).toBe(0)
    expect(clampScrollRatio(Number.NaN)).toBe(0)
    expect(clampScrollRatio(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe("clampReaderSemitones", () => {
  it("rounds to a whole semitone inside one octave", () => {
    expect(clampReaderSemitones(3.4)).toBe(3)
    expect(clampReaderSemitones(-3.6)).toBe(-4)
    expect(clampReaderSemitones(99)).toBe(READER_SEMITONES_LIMIT)
    expect(clampReaderSemitones(-99)).toBe(-READER_SEMITONES_LIMIT)
  })

  it("falls back to zero for non-numeric input", () => {
    expect(clampReaderSemitones(undefined)).toBe(0)
    expect(clampReaderSemitones(Number.NaN)).toBe(0)
  })
})

describe("clampReaderCapo", () => {
  it("keeps the capo on a fret between 0 and 12", () => {
    expect(clampReaderCapo(4.2)).toBe(4)
    expect(clampReaderCapo(-1)).toBe(0)
    expect(clampReaderCapo(40)).toBe(READER_MAX_CAPO)
  })

  it("falls back to zero for non-numeric input", () => {
    expect(clampReaderCapo(undefined)).toBe(0)
    expect(clampReaderCapo(Number.NaN)).toBe(0)
  })
})

describe("scrollRatioFor", () => {
  it("reports the travelled share of the range", () => {
    // 800 px of range travelled out of 1200 px.
    expect(scrollRatioFor(600, 2000, 800)).toBe(0.5)
    expect(scrollRatioFor(0, 2000, 800)).toBe(0)
    expect(scrollRatioFor(1200, 2000, 800)).toBe(1)
    expect(scrollRatioFor(99999, 2000, 800)).toBe(1)
  })

  it("has nothing to remember when the song fits on screen", () => {
    expect(scrollRatioFor(120, 400, 800)).toBe(0)
  })

  it("quantizes to 2% steps so a write does not happen per frame", () => {
    // 19% of 1200 = 228 → snapped to 20%.
    expect(scrollRatioFor(228, 2000, 800)).toBe(0.2)
    expect(scrollRatioFor(50, 2000, 800)).toBe(0.04)
  })
})

describe("scrollOffsetForRatio", () => {
  it("is the inverse of scrollRatioFor", () => {
    expect(scrollOffsetForRatio(0.5, 2000, 800)).toBe(600)
    expect(scrollOffsetForRatio(0, 2000, 800)).toBe(0)
    expect(scrollOffsetForRatio(1, 2000, 800)).toBe(1200)
  })

  it("clamps a ratio that arrived out of range", () => {
    expect(scrollOffsetForRatio(5, 2000, 800)).toBe(1200)
    expect(scrollOffsetForRatio(-1, 2000, 800)).toBe(0)
    expect(scrollOffsetForRatio(Number.NaN, 2000, 800)).toBe(0)
  })
})

describe("hasResumePoint", () => {
  it("ignores the top of the song", () => {
    expect(hasResumePoint(0)).toBe(false)
    expect(hasResumePoint(undefined)).toBe(false)
    expect(hasResumePoint(0.01)).toBe(false)
  })

  it("accepts a real jump", () => {
    expect(hasResumePoint(0.02)).toBe(true)
    expect(hasResumePoint(0.6)).toBe(true)
  })
})

describe("clampReaderFontSize", () => {
  it("keeps the size on a whole point inside the reader's range", () => {
    expect(clampReaderFontSize(18.4)).toBe(18)
    expect(clampReaderFontSize(1)).toBe(READER_FONT_MIN)
    expect(clampReaderFontSize(900)).toBe(READER_FONT_MAX)
  })

  it("falls back to the smallest size for non-numeric input", () => {
    expect(clampReaderFontSize(undefined)).toBe(READER_FONT_MIN)
    expect(clampReaderFontSize(Number.NaN)).toBe(READER_FONT_MIN)
  })
})

describe("pinchFontSize", () => {
  it("scales the starting size by the finger spread", () => {
    // Fingers moved twice as far apart: 16 pt becomes 32, clamped to the max.
    expect(pinchFontSize(16, 100, 200)).toBe(READER_FONT_MAX)
    // Half the spread: 20 pt becomes 10, clamped to the min.
    expect(pinchFontSize(20, 100, 50)).toBe(READER_FONT_MIN)
    // A 20% spread on 16 pt rounds to 19.
    expect(pinchFontSize(16, 100, 120)).toBe(19)
  })

  it("keeps the starting size when the gesture is unusable", () => {
    expect(pinchFontSize(18, 0, 120)).toBe(18)
    expect(pinchFontSize(18, 100, Number.NaN)).toBe(18)
  })
})
