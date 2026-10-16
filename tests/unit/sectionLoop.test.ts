import { describe, expect, it } from "vitest"

import { loopCycleBeats, loopPassSeconds, sectionLoopView } from "@/libs/sectionLoop"

// The loop's shape: one count-in bar (4 beats) then the section's 8 bars at
// 4/4, so a cycle is 4 + 32 = 36 beats and pass 1 runs beats 4..35.
const loop = { sectionId: "s1", bars: 8 }

describe("loopCycleBeats", () => {
  it("counts the count-in bar plus the section's bars", () => {
    expect(loopCycleBeats(8, 4, 4)).toBe(36)
    // Count-in off: the section alone.
    expect(loopCycleBeats(8, 4, 0)).toBe(32)
    // 6/8 counts as six beats per bar, same as the metronome sheet shows.
    expect(loopCycleBeats(2, 6, 6)).toBe(18)
  })

  it("clamps nonsense instead of producing a zero cycle", () => {
    expect(loopCycleBeats(0, 4, 4)).toBe(8)
    expect(loopCycleBeats(8, 0, -3)).toBe(8)
  })
})

describe("sectionLoopView", () => {
  it("opens on the count-in, counting the beats of the pickup bar", () => {
    expect(sectionLoopView(loop, 4, 4, 0)).toEqual({
      repeat: 1,
      inCountIn: true,
      countInBeat: 1,
      barInPass: 1,
      barsPerPass: 8,
    })
    expect(sectionLoopView(loop, 4, 4, 3).countInBeat).toBe(4)
  })

  it("lands the first section downbeat right after the count-in", () => {
    const view = sectionLoopView(loop, 4, 4, 4)
    expect(view.inCountIn).toBe(false)
    expect(view.countInBeat).toBeNull()
    expect(view.repeat).toBe(1)
    expect(view.barInPass).toBe(1)
  })

  it("walks the bars and wraps into the next pass's count-in", () => {
    // Beat 8 is the second bar of the pass; beat 35 its last.
    expect(sectionLoopView(loop, 4, 4, 8).barInPass).toBe(2)
    expect(sectionLoopView(loop, 4, 4, 35)).toEqual({
      repeat: 1,
      inCountIn: false,
      countInBeat: null,
      barInPass: 8,
      barsPerPass: 8,
    })
    // Beat 36 starts the cycle over: pass 2 opens with its count-in again.
    const next = sectionLoopView(loop, 4, 4, 36)
    expect(next.repeat).toBe(2)
    expect(next.inCountIn).toBe(true)
    expect(next.countInBeat).toBe(1)
  })

  it("runs the whole section straight through when the count-in is off", () => {
    const view = sectionLoopView(loop, 4, 0, 0)
    expect(view.inCountIn).toBe(false)
    expect(view.repeat).toBe(1)
    expect(view.barInPass).toBe(1)
    // Cycle is 32 beats: the next pass begins at 32.
    expect(sectionLoopView(loop, 4, 0, 32).repeat).toBe(2)
  })

  it("treats the beat before the run as the downbeat (total on bad input)", () => {
    const view = sectionLoopView(loop, 4, 4, -6)
    expect(view.repeat).toBe(1)
    expect(view.inCountIn).toBe(true)
    expect(view.countInBeat).toBe(1)
  })
})

describe("loopPassSeconds", () => {
  it("measures the pass without the count-in, in the transport's tempo", () => {
    // 8 bars x 4 beats at 120 BPM = 32 half-seconds = 16 s.
    expect(loopPassSeconds(8, 4, 120)).toBe(16)
    expect(loopPassSeconds(8, 4, 60)).toBe(32)
  })

  it("clamps the tempo exactly like the engine does", () => {
    // 240 BPM is the engine's ceiling; 999 must not make the pass a sprint.
    expect(loopPassSeconds(8, 4, 999)).toBe(8)
  })
})
