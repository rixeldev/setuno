/**
 * The tuner engine (roadmap #13 spike): turns a raw microphone stream into
 * stable note readings.
 *
 * Pure TypeScript — no React, no DOM, no native modules — so the whole
 * analysis pipeline (windowing, decimation, detection, smoothing, the string's
 * decay hold) is exercised end to end in `tests/unit/tunerEngine.test.ts` with
 * chunks shaped exactly like the ones both platform seams deliver. The engine
 * is the spike; the seams only carry PCM.
 *
 * Cadence assumptions (verified against expo-audio's sdk-57 sources): native
 * `AudioStream` emits ~100 ms buffers (Android `AudioRecord` read size, iOS
 * `AVAudioEngine` tap), the web seam asks its `ScriptProcessorNode` for 4096
 * samples. One analysis per pushed chunk is therefore ~10 Hz — what a tuner
 * display wants, and what the measured budget in `pitchDetection.test.ts`
 * (~2.5 ms per analysis on desktop V8) comfortably affords.
 */

import {
  decimateBy2,
  nearestNote,
  TUNER_MAX_FREQUENCY,
  TUNER_MIN_CLARITY,
  TUNER_MIN_FREQUENCY,
  yinPitch,
} from "@/libs/pitchDetection"

/** Newest full-rate samples per analysis; halved by decimation when running
 * fast, so the O(n²) walk always sees 2048 samples (~85 ms at 24 kHz). */
export const TUNER_WINDOW_INPUT = 4096
/** At or above this rate the window is decimated ×2 before analysis. */
export const TUNER_DECIMATE_ABOVE = 32000
/** Chunks (≈ 100 ms each) a reading survives a string's decay before the
 * display goes blank — without it the needle flickers on every pluck. */
export const TUNER_HOLD_PUSHES = 6
/** Median-of-N over recent frequencies: a single glitched frame cannot move
 * the displayed note, while one frame of latency is imperceptible. */
export const TUNER_SMOOTHING = 5

export type TunerChunk = {
  /** Float32 PCM, interleaved when `channels > 1`. */
  data: ArrayBuffer | Float32Array
  /** Actual rate of this chunk — never assume the requested one survived. */
  sampleRate: number
  channels: number
}

export type TunerReading = {
  name: string
  octave: number
  midi: number
  /** Signed cents from the target, −50..50 (sharp positive). */
  cents: number
  frequency: number
  clarity: number
  /** Wall time of the last detection — the spike's on-device budget probe. */
  analysisMs: number
} | null

export type TunerEngine = {
  /** Feed one microphone chunk. Calls back once per analysed chunk. */
  push: (chunk: TunerChunk) => void
  /** Forget the stream's history (stop, or a restart). */
  reset: () => void
}

export type TunerEngineOptions = {
  /** Overrides {@link TUNER_MIN_CLARITY}. */
  minClarity?: number
}

export function createTunerEngine(
  onReading: (reading: TunerReading) => void,
  options: TunerEngineOptions = {}
): TunerEngine {
  const minClarity = options.minClarity ?? TUNER_MIN_CLARITY

  // Ring of the newest full-rate mono samples; the scratch window is copied
  // out of it newest-aligned, so chunk sizes never have to match.
  const ring = new Float32Array(TUNER_WINDOW_INPUT)
  let filled = 0
  let write = 0

  const history: number[] = []
  let quietPushes = 0
  const scratch = new Float32Array(TUNER_WINDOW_INPUT)

  function analyse(sampleRate: number): TunerReading {
    // Newest-aligned copy out of the ring.
    const start = (write - filled + ring.length) % ring.length
    for (let i = 0; i < filled; i++) {
      scratch[i] = ring[(start + i) % ring.length]
    }

    const decimate = sampleRate >= TUNER_DECIMATE_ABOVE
    const windowInput = decimate ? TUNER_WINDOW_INPUT : TUNER_WINDOW_INPUT / 2
    const view = scratch.subarray(filled - windowInput, filled)
    const analysisWindow = decimate ? decimateBy2(view) : view
    const analysisRate = decimate ? sampleRate / 2 : sampleRate

    const startedAt = performance.now()
    const estimate = yinPitch(analysisWindow, analysisRate)
    const analysisMs = performance.now() - startedAt

    if (estimate && estimate.clarity >= minClarity) {
      history.push(estimate.frequency)
      if (history.length > TUNER_SMOOTHING) history.shift()
      quietPushes = 0
      const sorted = [...history].sort((a, b) => a - b)
      const stable = sorted[sorted.length >> 1]
      const note = nearestNote(stable)
      if (note && stable >= TUNER_MIN_FREQUENCY && stable <= TUNER_MAX_FREQUENCY) {
        return { ...note, frequency: stable, clarity: estimate.clarity, analysisMs }
      }
      return null
    }

    // No pitch this chunk: hold the last stable reading through the decay.
    quietPushes = Math.min(quietPushes + 1, 99)
    if (history.length === 0 || quietPushes > TUNER_HOLD_PUSHES) return null
    const sorted = [...history].sort((a, b) => a - b)
    const stable = sorted[sorted.length >> 1]
    const note = nearestNote(stable)
    if (!note) return null
    return { ...note, frequency: stable, clarity: estimate ? estimate.clarity : 0, analysisMs }
  }

  return {
    push(chunk: TunerChunk): void {
      if (!(chunk.sampleRate > 0)) return
      const samples =
        chunk.data instanceof Float32Array ? chunk.data : new Float32Array(chunk.data as ArrayBuffer)
      if (samples.length === 0) return

      // Mono-mix down interleaved multi-channel input.
      const channels = Math.max(1, Math.floor(chunk.channels) || 1)
      if (channels === 1) {
        const take = Math.min(samples.length, ring.length)
        const source = samples.subarray(samples.length - take)
        for (let i = 0; i < take; i++) {
          ring[write] = source[i]
          write = (write + 1) % ring.length
        }
        filled = Math.min(filled + take, ring.length)
      } else {
        const frames = Math.floor(samples.length / channels)
        const take = Math.min(frames, ring.length)
        const firstFrame = frames - take
        for (let i = 0; i < take; i++) {
          let mixed = 0
          const base = (firstFrame + i) * channels
          for (let channel = 0; channel < channels; channel++) mixed += samples[base + channel]
          ring[write] = mixed / channels
          write = (write + 1) % ring.length
        }
        filled = Math.min(filled + take, ring.length)
      }

      if (filled < (chunk.sampleRate >= TUNER_DECIMATE_ABOVE ? TUNER_WINDOW_INPUT : TUNER_WINDOW_INPUT / 2)) {
        return
      }
      onReading(analyse(chunk.sampleRate))
    },

    reset(): void {
      filled = 0
      write = 0
      history.length = 0
      quietPushes = 0
    },
  }
}
