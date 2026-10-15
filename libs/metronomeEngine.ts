import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio"

import { clampBpm, nextBeats, reanchor, type MetronomeBeat } from "@/libs/metronome"

/**
 * The metronome's runtime (roadmap #11): owns the two click players and the
 * tick loop that turns the pure grid of `libs/metronome.ts` into sound.
 *
 * Timing model — check an absolute grid from a fixed-rate tick, never "one
 * interval since the last beat": every 25 ms the loop asks the grid which
 * beats fall inside its lookahead window and fires exactly those. A late tick
 * delays that click by at most its own lateness while the grid itself never
 * moves, which is what keeps a busy JS thread from dragging the tempo around;
 * beat math (including the "too late to bother" cutoff) is unit-tested in
 * `libs/metronome.ts`.
 *
 * `expo-audio` also ships a web build (an HTMLAudioElement under the hood), so
 * this one file serves every platform — there is deliberately no `.web.ts`
 * split, and one shared timing path is exactly what stops the two platforms
 * from feeling like different metronomes.
 *
 * The players are module singletons created on first use and kept for the
 * app's life: they cost two ~2 kB clicks in memory, and re-creating them on
 * every start would put a load delay on the first beat. A click is replayed by
 * seeking to 0 and pressing play (the expo-audio docs' own replay pattern); a
 * click lasts at most 55 ms and the closest two beats ever are 125 ms apart
 * (240 BPM), so a player is always finished before it is needed again.
 *
 * This module is plain TypeScript, not React: no hooks, no compiler rules —
 * the reader's `useMetronome` owns every piece of state.
 */

/** How often the loop checks the grid — comfortably under a beat at any tempo. */
const TICK_MS = 25
/** How far ahead of "now" a tick claims beats; two ticks of slop so no beat is ever missed by a late check. */
const LOOKAHEAD_MS = TICK_MS * 2

export interface MetronomeOptions {
  bpm: number
  beatsPerMeasure: number
  /** Leading pickup beats: one full bar when the count-in is on, else 0. */
  countInBeats: number
  accent: boolean
  /** Called the moment a beat fires — the UI pulse and the haptics ride this. */
  onBeat: (beat: MetronomeBeat) => void
}

export interface MetronomeHandle {
  /** New tempo without losing the phase: the bar continues where it was. */
  setBpm: (bpm: number) => void
  /** Ends the run; safe to call more than once. */
  stop: () => void
}

let accentPlayer: AudioPlayer | null = null
let clickPlayer: AudioPlayer | null = null
let silenceModeReady = false
let activeTimer: ReturnType<typeof setInterval> | null = null

const players = (): { accent: AudioPlayer; click: AudioPlayer } => {
  if (!accentPlayer) {
    accentPlayer = createAudioPlayer(require("../assets/metronome/accent.wav"))
    accentPlayer.volume = 1
  }
  if (!clickPlayer) {
    clickPlayer = createAudioPlayer(require("../assets/metronome/click.wav"))
    // The plain click sits under the accent so the downbeat reads by level as
    // well as by pitch — on a phone speaker the pitch alone can blur.
    clickPlayer.volume = 0.55
  }
  return { accent: accentPlayer, click: clickPlayer }
}

/**
 * Starts a run; any run already going is stopped first, so callers can
 * restart freely when a setting changes. The first beat lands one tick from
 * now — enough headroom to schedule it instead of squeezing the click out of
 * the same frame that pressed the button.
 */
export const startMetronome = (options: MetronomeOptions): MetronomeHandle => {
  const { accent, click } = players()
  if (!silenceModeReady) {
    silenceModeReady = true
    // A phone on the silent switch must still click. Fire-and-forget, like
    // the haptics: a failure is a quieter session, never a broken feature.
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined)
  }

  const grid = {
    anchorMs: Date.now() + TICK_MS,
    bpm: clampBpm(options.bpm),
    beatsPerMeasure: Math.max(1, Math.round(options.beatsPerMeasure)),
    countInBeats: Math.max(0, Math.round(options.countInBeats)),
    accent: options.accent,
    nextIndex: 0,
  }

  if (activeTimer) clearInterval(activeTimer)
  activeTimer = setInterval(() => {
    const { beats, nextIndex } = nextBeats(grid, Date.now(), LOOKAHEAD_MS)
    grid.nextIndex = nextIndex
    for (const beat of beats) {
      const player = beat.accent ? accent : click
      player.seekTo(0)
      player.play()
      options.onBeat(beat)
    }
  }, TICK_MS)

  let stopped = false
  return {
    setBpm: (bpm) => {
      const next = clampBpm(bpm)
      grid.anchorMs = reanchor(grid.anchorMs, grid.nextIndex, grid.bpm, next)
      grid.bpm = next
    },
    stop: () => {
      if (stopped) return
      stopped = true
      if (activeTimer) clearInterval(activeTimer)
      activeTimer = null
      // The clips are over anyway; pausing simply leaves no player mid-click
      // if the reader is reopened in the same session.
      accent.pause()
      click.pause()
    },
  }
}
