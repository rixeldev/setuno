import { clampBpm } from "@/libs/metronome"

/**
 * Practice loops (roadmap #15), pure: the arithmetic that turns the
 * metronome's beat stream into a section loop — a count-in bar, then the
 * section's bars, over and over until stopped. No timers, no React: the
 * engine (`libs/metronomeEngine.ts`) fires `beat.index` forever and a loop is
 * just phase over that index, so the two can never drift apart and a tempo
 * change (which the engine handles by re-anchoring) cannot move the loop.
 */

/** One section's loop: what it anchors to and how long a pass runs. */
export interface SectionLoop {
  sectionId: string
  /** Bars the section runs for (its `SongSection.bars`; the caller refuses 0). */
  bars: number
}

export interface SectionLoopView {
  /** Pass number, 1-based. */
  repeat: number
  /** True while the count-in bar *before* the pass plays. */
  inCountIn: boolean
  /** Beat within the count-in bar, 1-based (the big countdown number), or null. */
  countInBeat: number | null
  /** Bar within the pass, 1-based. */
  barInPass: number
  /** Bars a pass covers (what the caption shows). */
  barsPerPass: number
}

/** Beats one whole cycle covers: the count-in bar plus the section's bars. */
export const loopCycleBeats = (
  bars: number,
  beatsPerMeasure: number,
  countInBeats: number
): number =>
  Math.max(0, Math.round(countInBeats)) +
  Math.max(1, Math.round(bars)) * Math.max(1, Math.round(beatsPerMeasure))

/**
 * Where `beatIndex` sits in a loop of `bars` at this bar size and count-in.
 * Total by design: unknown bar sizes clamp to 1 and a negative index (the
 * beat before the run started) reads as the downbeat, so the display can
 * never show a NaN or a negative pass.
 */
export const sectionLoopView = (
  loop: SectionLoop,
  beatsPerMeasure: number,
  countInBeats: number,
  beatIndex: number
): SectionLoopView => {
  const beats = Math.max(1, Math.round(beatsPerMeasure))
  const bars = Math.max(1, Math.round(loop.bars))
  const countIn = Math.max(0, Math.round(countInBeats))
  const cycle = loopCycleBeats(bars, beats, countIn)
  const index = Math.max(0, Math.round(beatIndex))
  const phase = index % cycle
  const inCountIn = phase < countIn
  return {
    repeat: Math.floor(index / cycle) + 1,
    inCountIn,
    countInBeat: inCountIn ? (phase % beats) + 1 : null,
    barInPass: Math.floor(Math.max(0, phase - countIn) / beats) + 1,
    barsPerPass: bars,
  }
}

/** Seconds one pass of the section lasts (the sheet's "≈ 16 s per pass"). */
export const loopPassSeconds = (bars: number, beatsPerMeasure: number, bpm: number): number =>
  (Math.max(1, Math.round(bars)) * Math.max(1, Math.round(beatsPerMeasure)) * 60) /
  clampBpm(bpm)
