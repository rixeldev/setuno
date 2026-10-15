import { describe, expect, it } from "vitest"

import {
  CHORD_RING_SECONDS,
  CHORD_SAMPLE_RATE,
  STRUM_SPREAD_SECONDS,
  chordDurationMs,
  synthesizeChord,
} from "@/libs/chordSynth"
import { yinPitch } from "@/libs/pitchDetection"

/** The fundamental YIN should read back out of a synthesized single note. */
const detectedFrequency = (note: Float32Array, fromSeconds: number, sampleRate: number): number | null => {
  const start = Math.round(fromSeconds * sampleRate)
  const window = note.subarray(start, start + 4096)
  return yinPitch(window, sampleRate)?.frequency ?? null
}

describe("synthesizeChord", () => {
  it("runs for the ring time plus the strum spread", () => {
    // Five strings: the ring plus four 30 ms steps between them.
    const pluck = synthesizeChord([48, 52, 55, 60, 64], "pluck")
    expect(pluck.length).toBe(
      Math.ceil((CHORD_RING_SECONDS + STRUM_SPREAD_SECONDS * 4) * CHORD_SAMPLE_RATE)
    )
    // Piano strikes its keys almost together, so the spread barely grows.
    const piano = synthesizeChord([48, 52, 55], "piano")
    const pluckThree = synthesizeChord([48, 52, 55], "pluck")
    expect(piano.length).toBeLessThan(pluckThree.length)
    expect(chordDurationMs(5)).toBeGreaterThan(2700)
    expect(chordDurationMs(5)).toBeLessThan(2800)
  })

  it("is audible but never clips", () => {
    for (const timbre of ["pluck", "piano"] as const) {
      const out = synthesizeChord([40, 47, 52, 55, 59, 64], timbre)
      let peak = 0
      let invalid = 0
      for (const value of out) {
        if (!Number.isFinite(value)) invalid += 1
        if (Math.abs(value) > peak) peak = Math.abs(value)
      }
      expect(invalid, timbre).toBe(0)
      // Float32 storage rounds the limit up by one ULP: 0.85 comes back as
      // 0.85000002. The clip is the point, the last bit is not.
      expect(peak, timbre).toBeLessThanOrEqual(0.85 + 1e-6)
      expect(peak, timbre).toBeGreaterThan(0.1)
    }
  })

  it("returns nothing for an empty or degenerate request", () => {
    expect(synthesizeChord([], "pluck").length).toBe(0)
    expect(synthesizeChord([60], "pluck", { seconds: 0 }).length).toBe(0)
    expect(synthesizeChord([60], "pluck", { sampleRate: 0 }).length).toBe(0)
  })

  it("is deterministic: the same request sounds exactly the same", () => {
    expect(synthesizeChord([43, 50, 55], "pluck")).toEqual(
      synthesizeChord([43, 50, 55], "pluck")
    )
    expect(synthesizeChord([43, 50, 55], "piano")).toEqual(
      synthesizeChord([43, 50, 55], "piano")
    )
  })

  it("ends on silence instead of clicking", () => {
    for (const timbre of ["pluck", "piano"] as const) {
      const out = synthesizeChord([40, 44], timbre)
      expect(Math.abs(out[out.length - 1]), timbre).toBeLessThan(1e-9)
    }
  })

  it("opens on a soft onset instead of a burst of static", () => {
    // Two things made the first previews sound dirty: every string started at
    // full scale (no ramp) out of a raw full-band noise burst. Both are gone —
    // the excitation is pre-filtered through the ring and the first samples
    // ride a short ramp — so a lone note opens from silence, stays audible,
    // and never even reaches the clip limit.
    const out = synthesizeChord([43], "pluck", { seconds: 1.5 })
    let peak = 0
    for (const value of out) if (Math.abs(value) > peak) peak = Math.abs(value)
    expect(peak).toBeGreaterThan(0.05)
    expect(peak).toBeLessThan(0.85)
    expect(Math.abs(out[0])).toBeLessThan(0.02)
    expect(Math.abs(out[0])).toBeLessThan(peak / 10)
  })

  it("plucks a note at its written pitch", () => {
    // C4 = 261.63 Hz. Karplus-Strong runs an integer delay line, so the
    // reading lands within a fraction of a percent of it.
    const out = synthesizeChord([60], "pluck", { seconds: 1.5 })
    const frequency = detectedFrequency(out, 0.4, CHORD_SAMPLE_RATE)
    expect(frequency).not.toBeNull()
    if (frequency === null) return
    expect(frequency).toBeGreaterThan(261.63 * 0.985)
    expect(frequency).toBeLessThan(261.63 * 1.015)
  })

  it("strikes a piano note at its written pitch", () => {
    // A4 = 440 Hz; the slightly inharmonic partials must not drag the
    // perceived fundamental off its key.
    const out = synthesizeChord([69], "piano", { seconds: 1.5 })
    const frequency = detectedFrequency(out, 0.3, CHORD_SAMPLE_RATE)
    expect(frequency).not.toBeNull()
    if (frequency === null) return
    expect(frequency).toBeGreaterThan(440 * 0.985)
    expect(frequency).toBeLessThan(440 * 1.015)
  })
})
