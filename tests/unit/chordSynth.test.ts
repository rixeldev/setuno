import { describe, expect, it } from "vitest"

import {
  CHORD_RING_SECONDS,
  CHORD_SAMPLE_RATE,
  STRUM_SPREAD_SECONDS,
  chordDurationMs,
  strumVelocities,
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

/** RMS level of a slice of the sound — the envelope side of "how it starts". */
const rmsOf = (signal: Float32Array, fromSeconds: number, toSeconds: number, sampleRate: number): number => {
  const from = Math.round(fromSeconds * sampleRate)
  const to = Math.min(signal.length, Math.round(toSeconds * sampleRate))
  let energy = 0
  for (let i = from; i < to; i++) energy += signal[i] * signal[i]
  return Math.sqrt(energy / Math.max(1, to - from))
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
    // Five strings: the ring plus four 40 ms steps between them.
    const pluck = synthesizeChord([48, 52, 55, 60, 64], "pluck")
    expect(pluck.length).toBe(
      Math.ceil((CHORD_RING_SECONDS + STRUM_SPREAD_SECONDS * 4) * CHORD_SAMPLE_RATE)
    )
    // Piano strikes its keys almost together, so the spread barely grows.
    const piano = synthesizeChord([48, 52, 55], "piano")
    const pluckThree = synthesizeChord([48, 52, 55], "pluck")
    expect(piano.length).toBeLessThan(pluckThree.length)
    // 2.4 s ring + four steps + the UI's half-second of slack (250 ms).
    expect(chordDurationMs(5)).toBeGreaterThan(2790)
    expect(chordDurationMs(5)).toBeLessThan(2850)
  })

  it("rasgueos: strings arrive one behind the other, each with its own force", () => {
    // The owner's queued request: "strings one behind the other, like a real
    // strum". The stagger existed from day one — the test above pins its
    // arithmetic — but a sweep that strikes every string with *identical*
    // force still reads as one event, so each string now carries a
    // deterministic ±25 % of force, seeded by the chord's own midis.
    const midis = [43, 50, 55, 59, 62, 67]
    const velocities = strumVelocities(midis, "pluck")
    expect(velocities).toHaveLength(midis.length)
    for (const velocity of velocities) {
      expect(velocity).toBeGreaterThan(0.74)
      expect(velocity).toBeLessThan(1.26)
    }
    // Not machine-gun: the sweep has a strongest and a weakest string.
    expect(Math.max(...velocities) / Math.min(...velocities)).toBeGreaterThan(1.1)
    // Deterministic per chord; a different chord gets its own sweep.
    expect(strumVelocities(midis, "pluck")).toEqual(velocities)
    expect(strumVelocities([44, 50, 55], "pluck")).not.toEqual(velocities)
    // A lone note is not a strum; a piano is one gesture, struck together.
    expect(strumVelocities([60], "pluck")).toEqual([1])
    expect(strumVelocities(midis, "piano")).toEqual(midis.map(() => 1))
    // And the rendered chord really accumulates string by string: the window
    // around the fourth string's onset carries more than the opening one.
    const chord = synthesizeChord(midis, "pluck", { seconds: 2 })
    const opening = rmsOf(chord, 0, 0.02, CHORD_SAMPLE_RATE)
    const fourth = rmsOf(
      chord,
      3 * STRUM_SPREAD_SECONDS,
      3 * STRUM_SPREAD_SECONDS + 0.02,
      CHORD_SAMPLE_RATE
    )
    expect(fourth).toBeGreaterThan(opening)
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
    // Short window on purpose: the property is request → waveform, not length
    // (pinned above), and a 2.4 s comparison of two ~106k-sample arrays blew
    // the 5 s timeout under the suite's parallel load.
    const options = { seconds: 0.6 }
    expect(synthesizeChord([43, 50, 55], "pluck", options)).toEqual(
      synthesizeChord([43, 50, 55], "pluck", options)
    )
    expect(synthesizeChord([43, 50, 55], "piano", options)).toEqual(
      synthesizeChord([43, 50, 55], "piano", options)
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
    // slowly to ever tame it. The burst is band-limited to the note's own
    // first partials (the count shrinking with the string's pitch below the
    // 20-partial cap) and re-levelled, which is the whole fix: dark onset, low
    // centroid, same loudness, same pitch.
    const bass = synthesizeChord([24], "pluck", { seconds: 2 })
    const spectrum = spectralShare(bass, 0.3, CHORD_SAMPLE_RATE)
    expect(spectrum.highShare).toBeLessThan(0.05)
    expect(spectrum.centroid).toBeLessThan(400)
    // The pitch itself stays exact through the new filtering: E1 = 41.20 Hz.
    const e1 = synthesizeChord([28], "pluck", { seconds: 1.5 })
    const frequency = detectedFrequency(e1, 0.4, CHORD_SAMPLE_RATE)
    expect(frequency).not.toBeNull()
    if (frequency === null) return
    expect(frequency).toBeGreaterThan(41.2 * 0.985)
    expect(frequency).toBeLessThan(41.2 * 1.015)
  })

  it("swells into a bass note instead of slapping it", () => {
    // The owner's third audition: the low end was finally in the right place
    // but the bass still "sounded like a slap, not something deep". Slap is
    // an *envelope*: it attacks in a couple of milliseconds. A finger-plucked
    // thick string swells over a fraction of its own period, so the onset ramp
    // is now period-scaled — ~11 ms at E1, 14 ms at the low B of a 5-string —
    // while a high string still speaks almost at once. Measured as the RMS of
    // the first 8 ms against the note's body (50–300 ms): a bass opens well
    // under its own body level, a guitar C4 is already at full voice.
    const ratio = (midi: number): number => {
      const out = synthesizeChord([midi], "pluck", { seconds: 2 })
      return rmsOf(out, 0, 0.008, CHORD_SAMPLE_RATE) / rmsOf(out, 0.05, 0.3, CHORD_SAMPLE_RATE)
    }
    expect(ratio(23)).toBeLessThan(0.6) // B0, the 5-string low B
    expect(ratio(28)).toBeLessThan(0.5) // E1
    expect(ratio(60)).toBeGreaterThan(1) // C4 speaks immediately
  })

  it("does not mute the bright instruments while darkening the bass", () => {
    // The same rules must not flatten everything: a guitar C4 still opens with
    // the glass above 1 kHz that reads as a plucked string. The floor moved
    // down once (0.25 → 0.18) when the pluck's tilt arrived on the owner's
    // fourth audition ("struck with metal instead of a finger or pick"): what
    // reads as *string* is having glass at all, not how much — the piano this
    // owner calls "relatively good" sits at 0.01.
    const c4 = synthesizeChord([60], "pluck", { seconds: 2 })
    const spectrum = spectralShare(c4, 0.3, CHORD_SAMPLE_RATE)
    expect(spectrum.highShare).toBeGreaterThan(0.18)
    expect(spectrum.centroid).toBeGreaterThan(650)
  })

  it("opens a strummed chord warm, not like metal on metal", () => {
    // The same fourth audition, measured on the *chord* — the sound the chord
    // sheet actually previews. Before the tilt, a strummed G put 51 % of its
    // onset energy above 1 kHz (centroid 1382 Hz): the flat white-noise burst,
    // which reads as the strings being crashed into. A finger or pick releases
    // the string, so the partials fall ~6 dB/octave: the same window now opens
    // near 614 Hz with a sixth of the high-end share, while still well above
    // the piano's 1 % — this is the ceiling that stops the "metal" sound from
    // creeping back, the pair of the "glass" floor above.
    const chord = synthesizeChord([43, 50, 55, 59, 62, 67], "pluck", { seconds: 2 })
    const spectrum = spectralShare(chord, 0.03, CHORD_SAMPLE_RATE)
    expect(spectrum.highShare).toBeLessThan(0.3)
    expect(spectrum.centroid).toBeLessThan(900)
    expect(spectrum.highShare).toBeGreaterThan(0.05)
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
