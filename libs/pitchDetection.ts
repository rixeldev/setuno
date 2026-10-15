/**
 * Pitch detection for the tuner spike (roadmap #13).
 *
 * Pure TypeScript — no React, no DOM, no native modules — so the algorithm runs
 * on synthetic PCM in `tests/unit/pitchDetection.test.ts`, where the measured
 * accuracy and time budget *are* the spike's evidence.
 *
 * Algorithm: **YIN** (de Cheveigné & Kawahara, 2002) — the difference function
 * with cumulative-mean normalisation. Chosen over raw autocorrelation because
 * the normalisation removes the period-doubling bias that makes autocorrelation
 * report 220 Hz as 110 Hz, and over FFT methods because a 2048-sample direct
 * walk is ~1M multiply-adds: comfortably inside one 100 ms mic chunk on a phone
 * JS engine (see the benchmark test), with none of the FFT bookkeeping.
 */

/** YIN absolute threshold (the paper's default): first tau whose normalized
 * difference dips below this is the period candidate. */
export const TUNER_THRESHOLD = 0.15
/** Reject an estimate whose clarity (1 − normalized difference) is below this:
 * noise-like input that crossed the threshold only barely. */
export const TUNER_MIN_CLARITY = 0.6
/** Below a detuned bass low E; above the highest fretted note we care about. */
export const TUNER_MIN_FREQUENCY = 40
export const TUNER_MAX_FREQUENCY = 1400
/** ~ −80 dBFS: digital silence never reaches the O(n²) walk. */
export const TUNER_MIN_RMS = 1e-4

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

export type PitchEstimate = {
  /** Measured fundamental in Hz. */
  frequency: number
  /** 0..1 — how periodic the window looked at the chosen lag. */
  clarity: number
}

export type NearestNote = {
  name: string
  octave: number
  midi: number
  /** Signed cents from the equal-tempered target, −50..50 (sharp positive). */
  cents: number
}

export type YinOptions = {
  /** Overrides {@link TUNER_THRESHOLD}. */
  threshold?: number
  /** Overrides {@link TUNER_MIN_RMS}. */
  minRms?: number
}

/**
 * Detect the fundamental of a mono PCM window.
 *
 * `samples` should hold at least ~85 ms of audio (2048 at 24 kHz after the
 * engine's decimation): a window shorter than two periods of the lowest pitch
 * cannot resolve it. Returns `null` for silence, noise and out-of-range input —
 * never a guess.
 */
export function yinPitch(
  samples: Float32Array,
  sampleRate: number,
  options: YinOptions = {}
): PitchEstimate | null {
  const threshold = options.threshold ?? TUNER_THRESHOLD
  const minRms = options.minRms ?? TUNER_MIN_RMS
  const n = samples.length
  if (n < 8 || sampleRate <= 0) return null

  // RMS gate: silence is decided in O(n), not O(n²).
  let energy = 0
  for (let i = 0; i < n; i++) {
    energy += samples[i] * samples[i]
  }
  if (Math.sqrt(energy / n) < minRms) return null

  // The summation window W is the first half; tau runs up to W − 1 so every
  // comparison stays inside the buffer. This bounds the lowest resolvable
  // frequency to sampleRate / tauMax.
  const w = n >> 1
  const tauMax = Math.min(w - 1, Math.floor(sampleRate / TUNER_MIN_FREQUENCY))
  const tauMin = Math.max(2, Math.ceil(sampleRate / TUNER_MAX_FREQUENCY))
  if (tauMax <= tauMin) return null

  // d[tau] holds the difference function, then (reused) its cumulative-mean
  // normalisation. Index 0 is unused (tau starts at 1).
  const d = new Float64Array(tauMax + 1)
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0
    for (let j = 0; j < w; j++) {
      const diff = samples[j] - samples[j + tau]
      sum += diff * diff
    }
    d[tau] = sum
  }

  // Cumulative-mean normalisation: divides each difference by the running mean
  // of all smaller lags, so a periodic signal dips toward 0 while noise sits
  // around 1 — and the octave-down bias of raw autocorrelation disappears.
  // The whole function is normalised *before* searching for the crossing: the
  // trough descent and the interpolation below read neighbours of the chosen
  // lag, and a break at the crossing would leave them holding raw differences.
  let running = 0
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau]
    d[tau] = running > 0 ? (d[tau] * tau) / running : 1
  }

  let tauStar = -1
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (d[tau] < threshold) {
      tauStar = tau
      break
    }
  }

  if (tauStar === -1) {
    // Nothing crossed the threshold: take the best lag in range, but only if it
    // is convincingly periodic — anything worse is noise, not a quiet string.
    let best = Infinity
    let bestTau = -1
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (d[tau] < best) {
        best = d[tau]
        bestTau = tau
      }
    }
    if (bestTau === -1 || best > 0.5) return null
    tauStar = bestTau
  } else {
    // The paper's iterative absolute-threshold step: the first lag below the
    // threshold only marks the *beginning of the trough* — keep descending to
    // its floor. Stopping at the crossing biases every reading ~10 % of a
    // period high (≈ 167 cents) on broad dips such as a pure sine's.
    while (tauStar + 1 <= tauMax && d[tauStar + 1] < d[tauStar]) {
      tauStar++
    }
  }

  // Parabolic interpolation around the minimum: the true period almost never
  // lands on an integer lag, and this is what turns a ±1-lag quantisation
  // (~±20 cents at E2) into sub-cent accuracy.
  let refinedTau = tauStar
  if (tauStar > 1 && tauStar < tauMax) {
    const s0 = d[tauStar - 1]
    const s1 = d[tauStar]
    const s2 = d[tauStar + 1]
    const denominator = 2 * (2 * s1 - s2 - s0)
    if (denominator !== 0) refinedTau = tauStar + (s2 - s0) / denominator
  }
  if (refinedTau <= 0) return null

  const frequency = sampleRate / refinedTau
  if (frequency < TUNER_MIN_FREQUENCY || frequency > TUNER_MAX_FREQUENCY) return null

  return { frequency, clarity: 1 - d[tauStar] }
}

/** 440 Hz concert pitch; midi 69 = A4. */
export const A4_FREQUENCY = 440

/** Continuous midi value of a frequency (69 at A440). Non-positive → NaN. */
export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / A4_FREQUENCY)
}

/** The equal-tempered frequency of an integer midi note. */
export function midiToFrequency(midi: number): number {
  return A4_FREQUENCY * 2 ** ((midi - 69) / 12)
}

/** Nearest 12-TET note to a measured frequency, with the signed cents offset. */
export function nearestNote(frequency: number): NearestNote | null {
  if (!(frequency > 0) || !Number.isFinite(frequency)) return null
  const exact = frequencyToMidi(frequency)
  const midi = Math.round(exact)
  return {
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    midi,
    cents: (exact - midi) * 100,
  }
}

/**
 * Box-average decimation by 2: pairs of samples are averaged, so content above
 * the new Nyquist folds down attenuated instead of aliasing sharply. Pitch
 * work does not care about anything above ~12 kHz, and halving the rate makes
 * the O(n²) walk four times cheaper — the single best speed lever here.
 */
export function decimateBy2(input: Float32Array): Float32Array {
  const out = new Float32Array(input.length >> 1)
  for (let i = 0, j = 0; j < out.length; i += 2, j++) {
    out[j] = (input[i] + input[i + 1]) / 2
  }
  return out
}
