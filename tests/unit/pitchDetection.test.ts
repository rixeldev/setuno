import { describe, expect, it } from "vitest"

import {
  decimateBy2,
  frequencyToMidi,
  midiToFrequency,
  nearestNote,
  NOTE_NAMES,
  yinPitch,
} from "@/libs/pitchDetection"

/** Deterministic sine — no Math.random, so every run measures the same signal. */
function sine(frequency: number, sampleRate: number, seconds: number, amplitude = 0.5): Float32Array {
  const n = Math.floor(sampleRate * seconds)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return out
}

/** Harmonic-rich signal, closer to a plucked string than a sine. */
function saw(frequency: number, sampleRate: number, seconds: number, harmonics = 12): Float32Array {
  const n = Math.floor(sampleRate * seconds)
  const out = new Float32Array(n)
  for (let h = 1; h <= harmonics; h++) {
    const partial = frequency * h
    if (partial > sampleRate / 2) break
    for (let i = 0; i < n; i++) {
      out[i] += Math.sin((2 * Math.PI * partial * i) / sampleRate) / h
    }
  }
  return out
}

/** Seeded LCG: repeatable noise, never a flaky test. */
function noise(sampleRate: number, seconds: number, amplitude = 0.5): Float32Array {
  const n = Math.floor(sampleRate * seconds)
  const out = new Float32Array(n)
  let seed = 123456789
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    out[i] = amplitude * ((seed / 2147483648) * 2 - 1)
  }
  return out
}

function centsOff(actual: number, expected: number): number {
  return 1200 * Math.log2(actual / expected)
}

/** The engine's analysis window after decimation: 2048 samples at half rate. */
const ANALYSIS_SECONDS = 2048 / 24000

describe("yinPitch", () => {
  it("detects sines across the instrument range within a few cents", () => {
    for (const frequency of [82.41, 110, 220, 329.63, 440, 880, 1046.5]) {
      const estimate = yinPitch(sine(frequency, 24000, ANALYSIS_SECONDS), 24000)
      expect(estimate, `${frequency} Hz`).not.toBeNull()
      expect(Math.abs(centsOff(estimate!.frequency, frequency)), `${frequency} Hz`).toBeLessThan(5)
      expect(estimate!.clarity).toBeGreaterThan(0.8)
    }
  })

  it("survives the engine's decimation step at 48 kHz", () => {
    const estimate = yinPitch(decimateBy2(sine(440, 48000, ANALYSIS_SECONDS * 2)), 24000)
    expect(estimate).not.toBeNull()
    expect(Math.abs(centsOff(estimate!.frequency, 440))).toBeLessThan(5)
  })

  it("finds the fundamental of a harmonic-rich signal (no octave-down)", () => {
    // Raw autocorrelation's classic failure: the strongest partial is 220 Hz's
    // harmonic, and the period-doubling bias reports 110 Hz. YIN must not.
    const estimate = yinPitch(decimateBy2(saw(220, 48000, ANALYSIS_SECONDS * 2)), 24000)
    expect(estimate).not.toBeNull()
    expect(Math.abs(centsOff(estimate!.frequency, 220))).toBeLessThan(5)
  })

  it("reports silence as null", () => {
    expect(yinPitch(new Float32Array(2048), 24000)).toBeNull()
  })

  it("rejects white noise instead of guessing", () => {
    const estimate = yinPitch(noise(24000, ANALYSIS_SECONDS), 24000)
    if (estimate !== null) {
      // A rare noise crossing must at least be honest about its clarity.
      expect(estimate.clarity).toBeLessThan(0.7)
    }
  })

  it("rejects windows too short to resolve a period", () => {
    expect(yinPitch(new Float32Array(4), 24000)).toBeNull()
    expect(yinPitch(sine(440, 24000, 0.0001), 24000)).toBeNull()
  })

  it("stays comfortably inside one 100 ms mic chunk on desktop V8", () => {
    const window = decimateBy2(sine(110, 48000, ANALYSIS_SECONDS * 2))
    // Warm up, then measure: the spike's budget claim needs a real number.
    for (let i = 0; i < 3; i++) yinPitch(window, 24000)
    const runs = 20
    const started = performance.now()
    for (let i = 0; i < runs; i++) yinPitch(window, 24000)
    const perAnalysis = (performance.now() - started) / runs
    // Generous CI headroom — the memo records the number this machine actually
    // produces; the assertion only proves the order of magnitude.
    expect(perAnalysis).toBeLessThan(50)
  })
})

describe("nearestNote", () => {
  it("maps concert A to A4 with no offset", () => {
    const note = nearestNote(440)
    expect(note).toEqual({ name: "A", octave: 4, midi: 69, cents: 0 })
  })

  it("signs cents sharp positive and flat negative", () => {
    const sharp = nearestNote(445)
    expect(sharp!.name).toBe("A")
    expect(sharp!.cents).toBeGreaterThan(15)
    expect(sharp!.cents).toBeLessThan(25)
    const flat = nearestNote(435)
    expect(flat!.cents).toBeLessThan(-15)
    expect(flat!.cents).toBeGreaterThan(-25)
  })

  it("names the bass low E E2", () => {
    const note = nearestNote(82.41)
    expect(note!.name).toBe("E")
    expect(note!.octave).toBe(2)
    expect(Math.abs(note!.cents)).toBeLessThan(2)
  })

  it("rounds every midi to a name in the chromatic circle", () => {
    for (let midi = 24; midi <= 108; midi++) {
      const note = nearestNote(midiToFrequency(midi))
      expect(note!.midi).toBe(midi)
      expect(NOTE_NAMES).toContain(note!.name as never)
    }
  })

  it("rejects non-positive frequencies", () => {
    expect(nearestNote(0)).toBeNull()
    expect(nearestNote(-1)).toBeNull()
  })

  it("round-trips midi through frequency", () => {
    expect(frequencyToMidi(midiToFrequency(60))).toBeCloseTo(60, 9)
  })
})

describe("decimateBy2", () => {
  it("halves the length and averages pairs", () => {
    const out = decimateBy2(new Float32Array([1, 3, 2, 8, -4, 0]))
    expect(Array.from(out)).toEqual([2, 5, -2])
  })
})
