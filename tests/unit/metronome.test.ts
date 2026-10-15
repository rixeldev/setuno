import { describe, expect, it } from "vitest"

import {
  beatMs,
  beatTimeMs,
  clampBpm,
  DEFAULT_BPM,
  MEASURE_LABELS,
  measureLabel,
  METRONOME_MAX_BPM,
  METRONOME_MIN_BPM,
  nextBeats,
  reanchor,
  tapTempoBpm,
  type MetronomeBeat,
  type MetronomeGrid,
} from "@/libs/metronome"

const grid = (overrides: Partial<MetronomeGrid> = {}): MetronomeGrid => ({
  anchorMs: 1_000,
  bpm: 120,
  beatsPerMeasure: 4,
  countInBeats: 0,
  accent: true,
  nextIndex: 0,
  ...overrides,
})

describe("clampBpm", () => {
  it("keeps in-range tempos and rounds fractions", () => {
    expect(clampBpm(120)).toBe(120)
    expect(clampBpm(92.6)).toBe(93)
    expect(clampBpm(92.4)).toBe(92)
  })

  it("bounds the extremes", () => {
    expect(clampBpm(0)).toBe(METRONOME_MIN_BPM)
    expect(clampBpm(-40)).toBe(METRONOME_MIN_BPM)
    expect(clampBpm(1000)).toBe(METRONOME_MAX_BPM)
  })

  it("falls back to the default for non-finite input", () => {
    expect(clampBpm(Number.NaN)).toBe(DEFAULT_BPM)
    expect(clampBpm(Number.POSITIVE_INFINITY)).toBe(DEFAULT_BPM)
  })
})

describe("beatMs", () => {
  it("is one minute over the tempo", () => {
    expect(beatMs(120)).toBe(500)
    expect(beatMs(60)).toBe(1000)
    expect(beatMs(240)).toBe(250)
  })

  it("clamps an out-of-range tempo before dividing", () => {
    expect(beatMs(0)).toBe(60000 / METRONOME_MIN_BPM)
  })
})

describe("measureLabel", () => {
  it("uses the conventional notation for offered bars", () => {
    expect(measureLabel(4)).toBe("4/4")
    expect(measureLabel(6)).toBe("6/8")
    for (const beats of [2, 3, 4, 5, 6]) {
      expect(MEASURE_LABELS[beats as keyof typeof MEASURE_LABELS]).toBeTruthy()
    }
  })

  it("falls back to a plain label for anything unexpected", () => {
    expect(measureLabel(7)).toBe("7/4")
  })
})

describe("nextBeats", () => {
  it("fires beat 0 when the anchor falls inside the window", () => {
    const state = grid()
    const { beats, nextIndex } = nextBeats(state, 990, 60)
    expect(beats).toEqual([
      { index: 0, withinMeasure: 0, accent: true, countIn: false },
    ])
    expect(nextIndex).toBe(1)
  })

  it("stays silent until the anchor arrives", () => {
    const { beats, nextIndex } = nextBeats(grid(), 900, 60)
    expect(beats).toEqual([])
    expect(nextIndex).toBe(0)
  })

  it("never re-fires a beat the grid already passed", () => {
    // Beat 3 lands at 2500; the window around 2490 catches it and nothing else.
    const { beats, nextIndex } = nextBeats(grid({ nextIndex: 3 }), 2490, 60)
    expect(beats.map((beat) => beat.index)).toEqual([3])
    expect(nextIndex).toBe(4)
  })

  it("walks the bar and accents only its downbeats", () => {
    // Driven like the engine's tick loop (25 ms checks): through t=3100 the
    // grid yields five beats and every index exactly once — no drift, no
    // double-fire — with the accent only on the two downbeats.
    const state = grid()
    const collected: MetronomeBeat[] = []
    for (let now = 900; now <= 3100; now += 25) {
      const { beats, nextIndex } = nextBeats(state, now, 50)
      state.nextIndex = nextIndex
      collected.push(...beats)
    }
    expect(collected.map((beat) => beat.index)).toEqual([0, 1, 2, 3, 4])
    expect(collected.map((beat) => beat.withinMeasure)).toEqual([0, 1, 2, 3, 0])
    expect(collected.map((beat) => beat.accent)).toEqual([true, false, false, false, true])
  })

  it("drops the accent when the setting is off", () => {
    const { beats } = nextBeats(grid({ accent: false }), 1600, 0)
    expect(beats.every((beat) => !beat.accent)).toBe(true)
  })

  it("flags the count-in beats and only those", () => {
    const state = grid({ countInBeats: 4 })
    const collected: MetronomeBeat[] = []
    for (let now = 900; now <= 3100; now += 25) {
      const { beats, nextIndex } = nextBeats(state, now, 50)
      state.nextIndex = nextIndex
      collected.push(...beats)
    }
    expect(collected.map((beat) => beat.countIn)).toEqual([true, true, true, true, false])
  })

  it("skips beats overdue by more than half a beat instead of firing them late", () => {
    // Anchor a full minute in the past at 120 BPM: over a hundred beats would
    // be due. A stalled thread must not replay them as a burst — only the
    // beat landing exactly now survives, everything older is dropped.
    const { beats, nextIndex } = nextBeats(grid(), 61_000, 0)
    expect(beats.map((beat) => beat.index)).toEqual([120])
    expect(nextIndex).toBe(121)
  })

  it("catches up with a single beat after a sub-beat stall", () => {
    // Late by 200 ms (under the 250 ms half-beat): the beat still fires, once.
    const { beats, nextIndex } = nextBeats(grid(), 1_200, 0)
    expect(beats).toEqual([
      { index: 0, withinMeasure: 0, accent: true, countIn: false },
    ])
    expect(nextIndex).toBe(1)
  })
})

describe("beatTimeMs", () => {
  it("computes from the anchor, never incrementally", () => {
    expect(beatTimeMs(1_000, 120, 4)).toBe(3_000)
  })
})

describe("reanchor", () => {
  it("keeps the last fired beat exactly where it was", () => {
    const oldAnchor = 1_000
    const fired = 5
    const next = reanchor(oldAnchor, fired, 120, 150)
    expect(beatTimeMs(next, 150, fired - 1)).toBe(beatTimeMs(oldAnchor, 120, fired - 1))
    // And the following beat lands one new interval after it.
    expect(beatTimeMs(next, 150, fired)).toBe(beatTimeMs(next, 150, fired - 1) + 400)
  })

  it("changes nothing before the first beat", () => {
    expect(reanchor(1_000, 0, 120, 150)).toBe(1_000)
  })
})

describe("tapTempoBpm", () => {
  it("needs at least three taps (two intervals)", () => {
    expect(tapTempoBpm([])).toBeNull()
    expect(tapTempoBpm([0])).toBeNull()
    expect(tapTempoBpm([0, 500])).toBeNull()
  })

  it("measures an even run", () => {
    // 500 ms between taps = 120 BPM.
    expect(tapTempoBpm([0, 500, 1000, 1500])).toBe(120)
    expect(tapTempoBpm([0, 750, 1500])).toBe(80)
  })

  it("trims the fastest and slowest interval when enough are available", () => {
    // Gaps 500, 500, 900: the 900 outlier is dropped → 120, not ~92.
    expect(tapTempoBpm([0, 500, 1000, 1900])).toBe(120)
  })

  it("breaks the run at a pause: only the trailing taps count", () => {
    // An old, well-tempered run followed by two fresh taps is still too short.
    expect(tapTempoBpm([0, 500, 1000, 10_000, 10_500])).toBeNull()
    // A fresh three-tap run after the pause measures on its own.
    expect(tapTempoBpm([0, 500, 1000, 10_000, 10_400, 10_800])).toBe(150)
  })

  it("clamps impossible tempos instead of returning them", () => {
    // 2.5 s between taps = 24 BPM: below the floor.
    expect(tapTempoBpm([0, 2_500, 5_000])).toBe(METRONOME_MIN_BPM)
    // 60 ms gaps: absurdly fast, capped at the ceiling.
    expect(tapTempoBpm([0, 60, 120, 180])).toBe(METRONOME_MAX_BPM)
  })

  it("ignores a non-increasing timestamp", () => {
    expect(tapTempoBpm([500, 500, 1000])).toBeNull()
  })
})
