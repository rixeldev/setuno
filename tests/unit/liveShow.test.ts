import { describe, expect, it } from "vitest"

import {
  breakRemainingSec,
  formatClock,
  liveProgressRatio,
  liveSetEntries,
  liveTotalSec,
  remainingSec,
  scheduleDeltaSec,
} from "@/libs/liveShow"
import type { LiveSetEntry } from "@/libs/liveShow"

const entry = (songId: string, durationSec: number | null): LiveSetEntry => ({
  songId,
  title: songId,
  durationSec,
})

describe("liveSetEntries", () => {
  it("joins the running order with each song's duration", () => {
    const entries = liveSetEntries({
      songs: [
        { songId: "a", title: "A", artist: "", key: "", order: 0 },
        { songId: "b", title: "B", artist: "", key: "", order: 1 },
      ],
      resolvedSongs: [
        { id: "a", durationSec: 180 },
        // b is missing from the resolved list (deleted song)
      ],
    } as never)
    expect(entries).toEqual([
      { songId: "a", title: "A", durationSec: 180 },
      { songId: "b", title: "B", durationSec: null },
    ])
  })
})

describe("live total and remaining", () => {
  const entries = [entry("a", 120), entry("b", 60), entry("c", null)]

  it("sums the known durations", () => {
    expect(liveTotalSec(entries)).toBe(180)
  })

  it("counts the music after the current song", () => {
    expect(remainingSec(entries, 0)).toBe(60)
    expect(remainingSec(entries, 2)).toBe(0)
    expect(remainingSec(entries, 9)).toBe(0)
  })
})

describe("scheduleDeltaSec", () => {
  it("is positive when running long", () => {
    expect(scheduleDeltaSec(700, 600)).toBe(100)
    expect(scheduleDeltaSec(500, 600)).toBe(-100)
  })

  it("is null without an estimate", () => {
    expect(scheduleDeltaSec(500, 0)).toBeNull()
  })
})

describe("breakRemainingSec", () => {
  it("clamps at zero and survives an empty break", () => {
    expect(breakRemainingSec(10_000, 4_000)).toBe(6)
    expect(breakRemainingSec(10_000, 12_000)).toBe(0)
    expect(breakRemainingSec(null, 12_000)).toBe(0)
  })
})

describe("formatClock", () => {
  it("formats minutes, seconds and hours", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(65)).toBe("1:05")
    expect(formatClock(3_600)).toBe("1:00:00")
    expect(formatClock(3_633)).toBe("1:00:33")
    expect(formatClock(-5)).toBe("0:00")
  })
})

describe("liveProgressRatio", () => {
  it("reports the completed fraction of the running order", () => {
    expect(liveProgressRatio(0, 4)).toBe(0.25)
    expect(liveProgressRatio(3, 4)).toBe(1)
    expect(liveProgressRatio(0, 0)).toBe(0)
  })
})
