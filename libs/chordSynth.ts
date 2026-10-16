import { midiToFrequency } from "@/libs/pitchDetection"

/**
 * Chord synthesis (roadmap #14 — "hear the chord").
 *
 * Pure TypeScript — no React, no DOM, no native modules — so the whole
 * timbre lives in unit tests: the same Karplus-Strong detector that proves the
 * tuner's readings (#13) verifies the pitch of what this produces, and the
 * platform seams (`libs/playChord.ts` / `.web.ts`) only carry the samples.
 *
 * Two timbres, one per way a note starts:
 * - **`pluck`** — Karplus-Strong, the classic digital waveguide: a noise burst
 *   circulates an integer delay line through a one-pole averaging filter, and
 *   the string decays exactly like a plucked one. Guitar, ukulele and bass all
 *   get it; only the frequencies differ. The burst is band-limited to the
 *   note's own first partials and re-levelled before it circulates — full-band
 *   noise at full scale is the "dirty, saturated" onset, and for a 33 Hz bass
 *   note it was also plainly the *wrong instrument*: white noise hands every
 *   partial equal energy, so a note with ~660 partials up to Nyquist still had
 *   59 % of its sound above 1 kHz and played back as a metallic ping.
 * - **`piano`** — a struck tone is not a plucked one, so piano gets a decaying
 *   stack of slightly inharmonic partials instead.
 *
 * Everything is deterministic (seeded noise, closed-form envelopes): the same
 * request always sounds the same, which is also what lets the tests compare
 * samples exactly.
 */

export type ChordTimbre = "pluck" | "piano"

/** What to sound: equal-tempered midis (any order) and a timbre. */
export interface ChordSound {
  midis: number[]
  timbre: ChordTimbre
}

export const CHORD_SAMPLE_RATE = 44100
/** How long the last string rings before the sound ends. */
export const CHORD_RING_SECONDS = 2.4
/** Strings are plucked in sequence, never all at once. */
export const STRUM_SPREAD_SECONDS = 0.03
/** Piano keys are struck together; a whisper of spread keeps it from buzzing. */
export const PIANO_SPREAD_SECONDS = 0.004
/** Time in which every string loses half its amplitude. A plain constant
 * damping would make a high C die seconds before a low E — real strings do
 * not, so the per-cycle factor is derived from this half-life instead. */
const STRING_HALF_LIFE_SECONDS = 1.8
/**
 * Brightness of the pluck, in **harmonic count** rather than Hz: the noise
 * burst is low-passed at a fixed multiple of the note itself, so every pitch
 * opens on the same *shape* — the first 20 partials — instead of every pitch
 * opening on the full band. That equality is what the old flat filter broke:
 * white noise hands every partial equal energy, so the partial *count* decided
 * the spectrum — 660 partials of kilohertz content for a 33 Hz bass note (the
 * "saturated metallic ping that isn't a bass" the owner heard) against 66
 * partials of a 330 Hz note, whose bulk already sat low enough to sound fine.
 */
const EXCITATION_HARMONICS = 20
/** Never strip a low note's partials away entirely. */
const EXCITATION_CUTOFF_MIN = 400
/** Never shave the top off a high note. */
const EXCITATION_CUTOFF_MAX = 8000
/**
 * The level the filtered burst is scaled back to, so cutting brightness never
 * changes loudness: it is the RMS the previous excitation measured (0.7 white
 * noise through two averaging passes ≈ 0.2), so previews open at the level the
 * owner already accepted — only the spectrum moves.
 */
const EXCITATION_RMS = 0.2
/** Each note opens on a short ramp: a step from silence to noise is a click. */
const PLUCK_ATTACK_SECONDS = 0.002
const PIANO_HARMONICS = 6
const PIANO_BASE_TAU_SECONDS = 1.1
const PIANO_ATTACK_SECONDS = 0.004
/** Steepness of the piano's harmonic stack: higher partials sit well under
 * the fundamental, so a chord reads as warm instead of buzzy. */
const PIANO_HARMONIC_ROLLOFF = 1.5
/** Several strings sum, so the mix is limited — never clipped. */
const TARGET_PEAK = 0.85
/** The ending fades on a raised cosine: a still-ringing string cut off clicks. */
const FADE_SECONDS = 0.25

/** Wall-clock length of a chord sound, for the UI's "still playing" window. */
export const chordDurationMs = (noteCount: number): number =>
  Math.ceil((CHORD_RING_SECONDS + STRUM_SPREAD_SECONDS * Math.max(0, noteCount - 1)) * 1000) + 250

/** Seeded LCG in −1..1: same request, same waveform. */
const noise = (state: { seed: number }): number => {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0
  return (state.seed / 4294967296) * 2 - 1
}

/** Karplus-Strong plucked string: noise burst, integer delay, averaged feedback. */
function pluckedString(frequency: number, length: number, sampleRate: number): Float32Array {
  const period = Math.max(2, Math.round(sampleRate / frequency))
  const state = { seed: (Math.round(frequency * 1000) ^ 0x9e3779b9) >>> 0 }
  const delay = new Float32Array(period)
  for (let i = 0; i < period; i++) delay[i] = noise(state)
  // Band-limit the burst to the note's own first partials (two cascaded
  // one-poles, −12 dB/oct): a low note must open dark like a thick string,
  // a high note keeps its glass. Fixed-Hz filtering can only pick one side.
  const cutoff =
    Math.min(
      EXCITATION_CUTOFF_MAX,
      Math.max(EXCITATION_CUTOFF_MIN, Math.abs(frequency) * EXCITATION_HARMONICS)
    ) / sampleRate
  const a = 1 - Math.exp(-2 * Math.PI * cutoff)
  let pole1 = 0
  let pole2 = 0
  for (let i = 0; i < period; i++) {
    pole1 += a * (delay[i] - pole1)
    pole2 += a * (pole1 - pole2)
    delay[i] = pole2
  }
  // Re-level after filtering (band-limiting a low note costs most of its
  // energy): same loudness for every pitch, only the spectrum differs. The
  // mean is removed too — leftover DC in the delay line would bias the loop.
  let energy = 0
  for (let i = 0; i < period; i++) energy += delay[i]
  const mean = energy / period
  energy = 0
  for (let i = 0; i < period; i++) {
    delay[i] -= mean
    energy += delay[i] * delay[i]
  }
  const gain = energy > 0 ? EXCITATION_RMS / Math.sqrt(energy / period) : 0
  for (let i = 0; i < period; i++) delay[i] *= gain
  // Per-cycle damping for the string's constant *time* half-life.
  const damping = 0.5 ** (1 / (frequency * STRING_HALF_LIFE_SECONDS))
  const attack = Math.min(Math.max(2, Math.round(PLUCK_ATTACK_SECONDS * sampleRate)), length)
  const out = new Float32Array(length)
  let index = 0
  for (let i = 0; i < length; i++) {
    const current = delay[index]
    const next = delay[(index + 1) % period]
    out[i] = i < attack ? current * ((i + 1) / attack) : current
    delay[index] = damping * 0.5 * (current + next)
    index = index + 1 === period ? 0 : index + 1
  }
  return out
}

/** Struck, piano-ish tone: a decaying stack of slightly inharmonic partials. */
function pianoNote(frequency: number, length: number, sampleRate: number): Float32Array {
  const out = new Float32Array(length)
  const state = { seed: (Math.round(frequency * 1000) ^ 0x85ebca6b) >>> 0 }
  const attack = Math.max(1, Math.round(PIANO_ATTACK_SECONDS * sampleRate))
  for (let harmonic = 1; harmonic <= PIANO_HARMONICS; harmonic++) {
    // Real strings stiffen: partials sit slightly sharp of the integer series.
    const partial = frequency * harmonic * (1 + 0.0004 * harmonic * harmonic)
    if (partial > sampleRate / 2) break
    const amplitude = 1 / harmonic ** PIANO_HARMONIC_ROLLOFF
    const decayStep = Math.exp(-1 / ((PIANO_BASE_TAU_SECONDS / harmonic ** 0.6) * sampleRate))
    const phaseStep = (2 * Math.PI * partial) / sampleRate
    let envelope = 1
    let phase = noise(state) * Math.PI
    for (let i = 0; i < length; i++) {
      const attackEnvelope = i < attack ? (i + 1) / attack : 1
      out[i] += Math.sin(phase) * amplitude * envelope * attackEnvelope
      phase += phaseStep
      envelope *= decayStep
    }
  }
  return out
}

/**
 * Sound a chord: each midi pluck/struck in turn, summed, peak-limited and
 * faded at the end. Returns an empty array for an empty (or degenerate)
 * request, which both seams treat as "nothing to play".
 */
export function synthesizeChord(
  midis: readonly number[],
  timbre: ChordTimbre,
  options: { sampleRate?: number; seconds?: number } = {}
): Float32Array {
  const sampleRate = options.sampleRate ?? CHORD_SAMPLE_RATE
  const ringSeconds = options.seconds ?? CHORD_RING_SECONDS
  if (midis.length === 0 || !(sampleRate > 0) || !(ringSeconds > 0)) return new Float32Array(0)

  const spread = timbre === "piano" ? PIANO_SPREAD_SECONDS : STRUM_SPREAD_SECONDS
  const total = Math.ceil((ringSeconds + spread * (midis.length - 1)) * sampleRate)
  const out = new Float32Array(total)

  midis.forEach((midi, order) => {
    const frequency = midiToFrequency(midi)
    if (!(frequency > 0)) return
    const offset = Math.round(spread * order * sampleRate)
    const length = total - offset
    if (length <= 0) return
    const note =
      timbre === "piano" ? pianoNote(frequency, length, sampleRate) : pluckedString(frequency, length, sampleRate)
    for (let i = 0; i < length; i++) out[offset + i] += note[i]
  })

  let peak = 0
  for (let i = 0; i < total; i++) {
    const absolute = Math.abs(out[i])
    if (absolute > peak) peak = absolute
  }
  if (peak > TARGET_PEAK) {
    const gain = TARGET_PEAK / peak
    for (let i = 0; i < total; i++) out[i] *= gain
  }

  const fade = Math.min(Math.round(FADE_SECONDS * sampleRate), total - 1)
  const fadeStart = total - 1 - fade
  for (let i = fadeStart; i < total; i++) {
    const position = fade === 0 ? 1 : (i - fadeStart) / fade
    out[i] *= 0.5 * (1 + Math.cos(Math.PI * position))
  }
  return out
}
