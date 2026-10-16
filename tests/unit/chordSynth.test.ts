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

/** Iterative radix-2 FFT, in place, real and imaginary parts separate. */
const fft = (re: Float64Array, im: Float64Array): void => {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const swapRe = re[i]
      re[i] = re[j]
      re[j] = swapRe
      const swapIm = im[i]
      im[i] = im[j]
      im[j] = swapIm
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k]
        const aIm = im[i + k]
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe
        re[i + k] = aRe + bRe
        im[i + k] = aIm + bIm
        re[i + k + len / 2] = aRe - bRe
        im[i + k + len / 2] = aIm - bIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

/**
 * One window of the sound, read like an analyzer: the share of energy sitting
 * above 1 kHz and the spectral centroid, from a Hann-windowed FFT. This is
 * what tells "a bass" apart from "a metallic ping" — pitch detection alone
 * cannot, because the pitch was always right.
 */
const spectralShare = (
  signal: Float32Array,
  fromSeconds: number,
  sampleRate: number
): { highShare: number; centroid: number } => {
  const size = 16384
  const start = Math.round(fromSeconds * sampleRate)
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (let i = 0; i < size; i++) {
    const sample = start + i < signal.length ? signal[start + i] : 0
    re[i] = sample * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size))
  }
  fft(re, im)
  const bin = sampleRate / size
  let total = 0
  let high = 0
  let weighted = 0
  for (let k = 1; k < size / 2; k++) {
    const power = re[k] * re[k] + im[k] * im[k]
    total += power
    weighted += power * k * bin
    if (k * bin >= 1000) high += power
  }
  return { highShare: total > 0 ? high / total : 0, centroid: total > 0 ? weighted / total : 0 }
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
    // the excitation is band-limited and re-levelled before it circulates and
    // the first samples ride a short ramp — so a lone note opens from silence,
    // stays audible, and never even reaches the clip limit.
    const out = synthesizeChord([43], "pluck", { seconds: 1.5 })
    let peak = 0
    for (const value of out) if (Math.abs(value) > peak) peak = Math.abs(value)
    expect(peak).toBeGreaterThan(0.05)
    expect(peak).toBeLessThan(0.85)
    expect(Math.abs(out[0])).toBeLessThan(0.02)
    expect(Math.abs(out[0])).toBeLessThan(peak / 10)
  })

  it("sounds like a bass, not a metallic ping", () => {
    // The owner's second audition of #14 (roadmap handoff): the bass previews
    // were "saturated and not at the frequency of a bass — like a high string
    // hit hard with something metallic". The pitch was never wrong (YIN reads
    // E1 back exactly, asserted below); the spectrum was: white-noise
    // excitation hands *every* partial equal energy, so a 33 Hz note with ~660
    // partials up to Nyquist put 59 % of its energy above 1 kHz — and for a
    // low note the loop's averaging filter runs only 33 times a second, too
    // slowly to ever tame it. The burst is now band-limited to the note's own
    // first partials (EXCITATION_HARMONICS) and re-levelled, which is the
    // whole fix: dark onset, low centroid, same loudness, same pitch.
    const bass = synthesizeChord([24], "pluck", { seconds: 2 })
    const spectrum = spectralShare(bass, 0.3, CHORD_SAMPLE_RATE)
    expect(spectrum.highShare).toBeLessThan(0.12)
    expect(spectrum.centroid).toBeLessThan(800)
    // The pitch itself stays exact through the new filtering: E1 = 41.20 Hz.
    const e1 = synthesizeChord([28], "pluck", { seconds: 1.5 })
    const frequency = detectedFrequency(e1, 0.4, CHORD_SAMPLE_RATE)
    expect(frequency).not.toBeNull()
    if (frequency === null) return
    expect(frequency).toBeGreaterThan(41.2 * 0.985)
    expect(frequency).toBeLessThan(41.2 * 1.015)
  })

  it("does not mute the bright instruments while darkening the bass", () => {
    // The same harmonic-count rule must not flatten everything: a guitar C4
    // still opens with the glass above 1 kHz that reads as a plucked string.
    const c4 = synthesizeChord([60], "pluck", { seconds: 2 })
    const spectrum = spectralShare(c4, 0.3, CHORD_SAMPLE_RATE)
    expect(spectrum.highShare).toBeGreaterThan(0.25)
    expect(spectrum.centroid).toBeGreaterThan(700)
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
