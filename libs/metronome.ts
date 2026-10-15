/**
 * Metronome timing, pure (roadmap #11): beat scheduling, tempo bounds and
 * tap tempo. No timers, no audio, no React — `libs/metronomeEngine.ts` owns
 * the clock and the players; everything decidable with arithmetic lives here
 * so it can be unit-tested without a device.
 */

/** Nobody practises a song at 29 or 241 BPM. */
export const METRONOME_MIN_BPM = 30
export const METRONOME_MAX_BPM = 240
/** Tempo a song without a stored BPM starts from. */
export const DEFAULT_BPM = 120

/** Bars the sheet offers. */
export const BEATS_PER_MEASURE = [2, 3, 4, 5, 6] as const
export type BeatsPerMeasure = (typeof BEATS_PER_MEASURE)[number]

/**
 * Conventional notation for each bar size — universal music notation, not
 * prose, so it is never translated.
 */
export const MEASURE_LABELS: Record<BeatsPerMeasure, string> = {
  2: "2/4",
  3: "3/4",
  4: "4/4",
  5: "5/4",
  6: "6/8",
}

/** A tap older than this no longer belongs to the run being measured. */
export const TAP_WINDOW_MS = 3000
/**
 * Taps kept for the estimate: enough for a stable average, few enough that a
 * late tap is quickly forgiven.
 */
export const TAP_MAX_TAPS = 5

/** Whole beats only; non-finite input falls back to the default tempo. */
export const clampBpm = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_BPM
  return Math.min(METRONOME_MAX_BPM, Math.max(METRONOME_MIN_BPM, Math.round(value)))
}

/** Milliseconds between two beats of `bpm`. */
export const beatMs = (bpm: number): number => 60000 / clampBpm(bpm)

/** Label for a bar size ("4/4"), with a plain fallback for anything unexpected. */
export const measureLabel = (beatsPerMeasure: number): string =>
  MEASURE_LABELS[beatsPerMeasure as BeatsPerMeasure] ?? `${beatsPerMeasure}/4`

/** One beat of the running metronome. */
export interface MetronomeBeat {
  /** Beats since the run started, count-in included. */
  index: number
  /** Position inside the bar, 0 = downbeat. */
  withinMeasure: number
  /** Downbeat of a bar (only when the accent is on). */
  accent: boolean
  /** True while the count-in measure is still playing. */
  countIn: boolean
}

/** The grid a run ticks along: one anchor plus everything that spaces the beats. */
export interface MetronomeGrid {
  /** Wall-clock time (ms) beat 0 lands on. */
  anchorMs: number
  bpm: number
  beatsPerMeasure: number
  /** Leading pickup beats before the groove: one full bar when count-in is on. */
  countInBeats: number
  /** Whether downbeats get the accent click. */
  accent: boolean
  /** Index of the next beat to fire. */
  nextIndex: number
}

/** When the beat of `index` lands, relative to the grid's anchor. */
export const beatTimeMs = (anchorMs: number, bpm: number, index: number): number =>
  anchorMs + index * beatMs(bpm)

/**
 * Beats due in `(now − halfBeat, now + lookaheadMs]`, plus the index to
 * continue from. Two timing decisions live here, both deliberate:
 *
 * - Every time is computed from the **anchor**, never from "the last beat plus
 *   one interval": a hiccup on the JS thread can delay a tick but can never
 *   move the grid, so the tempo does not drift. (A plain
 *   `setInterval(beatMs)` metronome accumulates every stall forever.)
 * - A beat overdue by more than half a beat is **skipped, not fired late**: a
 *   thread that stalled for seconds would otherwise replay the missed clicks
 *   as a burst, which is worse musically than losing them. The drop is
 *   computed in O(1) — after an hour in the background it is one division,
 *   not a hundred thousand loop iterations.
 */
export const nextBeats = (
  grid: MetronomeGrid,
  nowMs: number,
  lookaheadMs: number,
): { beats: MetronomeBeat[]; nextIndex: number } => {
  const interval = beatMs(grid.bpm)
  const firstSurviving = Math.ceil((nowMs - interval / 2 - grid.anchorMs) / interval)
  let index = Math.max(grid.nextIndex, firstSurviving)

  const beats: MetronomeBeat[] = []
  while (beatTimeMs(grid.anchorMs, grid.bpm, index) <= nowMs + lookaheadMs) {
    const withinMeasure = index % grid.beatsPerMeasure
    beats.push({
      index,
      withinMeasure,
      accent: grid.accent && withinMeasure === 0,
      countIn: index < grid.countInBeats,
    })
    index += 1
  }
  return { beats, nextIndex: index }
}

/**
 * New anchor for a tempo change mid-run: the **last fired beat keeps its
 * place** and the next one lands one new interval after it, so nudging the
 * tempo never makes the bar jump. Before any beat has fired there is nothing
 * to preserve and the anchor stands.
 */
export const reanchor = (
  anchorMs: number,
  firedBeats: number,
  oldBpm: number,
  newBpm: number,
): number =>
  firedBeats <= 0
    ? anchorMs
    : anchorMs + (firedBeats - 1) * (beatMs(oldBpm) - beatMs(newBpm))

/**
 * BPM from tap timestamps (ms), or `null` while the run is too short to
 * estimate. A tap older than `TAP_WINDOW_MS` breaks the run: only the trailing
 * unbroken sequence counts, so putting the phone down and tapping again starts
 * fresh instead of averaging across the pause. With three or more intervals
 * the fastest and slowest are dropped (a trimmed mean), so one mistimed tap
 * moves the tempo far less than it used to.
 */
export const tapTempoBpm = (taps: readonly number[]): number | null => {
  const gaps: number[] = []
  for (let i = taps.length - 1; i > 0; i--) {
    const gap = taps[i] - taps[i - 1]
    if (gap <= 0 || gap > TAP_WINDOW_MS) break
    gaps.unshift(gap)
  }
  if (gaps.length < 2) return null
  const sorted = [...gaps].sort((a, b) => a - b)
  const core = gaps.length >= 3 ? sorted.slice(1, -1) : sorted
  const average = core.reduce((sum, gap) => sum + gap, 0) / core.length
  return clampBpm(60000 / average)
}
