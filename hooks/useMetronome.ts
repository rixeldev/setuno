import { useCallback, useEffect, useRef, useState } from "react"

import {
  clampBpm,
  DEFAULT_BPM,
  tapTempoBpm,
  TAP_MAX_TAPS,
  type MetronomeBeat,
} from "@/libs/metronome"
import { startMetronome, type MetronomeHandle } from "@/libs/metronomeEngine"
import { hapticBeat } from "@/libs/haptics"

/**
 * Session transport for the reader's metronome (roadmap #11). It owns the
 * tempo and the settings the sheet edits; `libs/metronomeEngine.ts` owns the
 * sound. Like the reader's other session state it lives for one visit of the
 * screen: stepping to the next song starts over, and leaving the reader stops
 * the clicks.
 *
 * - The BPM **derives** from the song (`song.bpm`, else the default) until the
 *   user changes it (`manualBpm`). Deriving — instead of seeding `useState`
 *   once — is what makes a song that finishes loading *after* the screen
 *   mounted still open the metronome at its own tempo, with no effect that
 *   writes state while rendering watches the load.
 * - A tempo edit follows a **running** engine through a re-anchor (the bar
 *   continues at the new spacing); changing the bar, the accent or the
 *   count-in restarts the run, because the engine reads those when it starts.
 * - `beat` is the last beat that fired (`null` while stopped): the dots, the
 *   count-in number and the haptics all read it.
 */
export function useMetronome(songBpm: number | null) {
  const [manualBpm, setManualBpm] = useState<number | null>(null)
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4)
  const [accent, setAccent] = useState(true)
  const [countIn, setCountIn] = useState(false)
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState<MetronomeBeat | null>(null)

  const handleRef = useRef<MetronomeHandle | null>(null)
  const tapsRef = useRef<number[]>([])

  const bpm = manualBpm ?? clampBpm(songBpm ?? DEFAULT_BPM)

  /** (Re)start with these settings; the bar begins again from its downbeat. */
  const startWith = useCallback(
    (settings: { bpm: number; beatsPerMeasure: number; accent: boolean; countIn: boolean }) => {
      handleRef.current?.stop()
      handleRef.current = startMetronome({
        bpm: settings.bpm,
        beatsPerMeasure: settings.beatsPerMeasure,
        countInBeats: settings.countIn ? settings.beatsPerMeasure : 0,
        accent: settings.accent,
        onBeat: (next) => {
          setBeat(next)
          hapticBeat(next.accent)
        },
      })
      tapsRef.current = []
      setRunning(true)
    },
    [],
  )

  const stop = useCallback(() => {
    handleRef.current?.stop()
    handleRef.current = null
    setRunning(false)
    setBeat(null)
  }, [])

  const toggle = useCallback(() => {
    if (running) {
      stop()
      return
    }
    startWith({ bpm, beatsPerMeasure, accent, countIn })
  }, [running, bpm, beatsPerMeasure, accent, countIn, startWith, stop])

  const changeBpm = useCallback((value: number) => setManualBpm(clampBpm(value)), [])

  /**
   * Tap tempo: the raw timestamps live in a ref (a new array every tap, no
   * history state to render), the estimate comes from the pure helper. Tapping
   * while running adjusts the tempo in place — the effect below re-anchors the
   * engine, so the groove never stops for it.
   */
  const tap = useCallback(() => {
    const taps = tapsRef.current.concat(Date.now()).slice(-TAP_MAX_TAPS)
    tapsRef.current = taps
    const tapped = tapTempoBpm(taps)
    if (tapped !== null) setManualBpm(tapped)
  }, [])

  // A tempo edit follows a running engine without losing the phase. Side
  // effect on a native handle only — no state is written here.
  useEffect(() => {
    handleRef.current?.setBpm(bpm)
  }, [bpm])

  // Leaving the reader (or a step to the next song, which remounts the screen)
  // silences the clicks.
  useEffect(
    () => () => {
      handleRef.current?.stop()
      handleRef.current = null
    },
    [],
  )

  const changeBeatsPerMeasure = useCallback(
    (next: number) => {
      setBeatsPerMeasure(next)
      // Live in the bar the engine was started with: restart to apply it.
      if (running) startWith({ bpm, beatsPerMeasure: next, accent, countIn })
    },
    [running, bpm, accent, countIn, startWith],
  )

  const changeAccent = useCallback(
    (next: boolean) => {
      setAccent(next)
      if (running) startWith({ bpm, beatsPerMeasure, accent: next, countIn })
    },
    [running, bpm, beatsPerMeasure, countIn, startWith],
  )

  const changeCountIn = useCallback(
    (next: boolean) => {
      setCountIn(next)
      // The count-in only plays from a fresh start anyway, but restarting here
      // keeps "what you see" and "what plays" identical instead of explaining
      // that the toggle takes effect next time.
      if (running) startWith({ bpm, beatsPerMeasure, accent, countIn: next })
    },
    [running, bpm, beatsPerMeasure, accent, startWith],
  )

  return {
    bpm,
    beatsPerMeasure,
    accent,
    countIn,
    running,
    beat,
    toggle,
    stop,
    tap,
    changeBpm,
    changeBeatsPerMeasure,
    changeAccent,
    changeCountIn,
  }
}
