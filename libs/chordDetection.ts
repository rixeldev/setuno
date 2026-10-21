/**
 * Estimates the chords of a recording (roadmap #85).
 *
 * The core is **pure and offline**: it takes the samples the microphone gave
 * (float32 PCM) and returns the chords it heard, with the time each one
 * lasted and how sure it was. Nothing is uploaded and no model is involved —
 * the maths is a spectrum, a chroma and a set of templates.
 *
 * It is deliberately **approximate**: a guitar in a room is not a sine wave.
 * The label that says so travels with the result (`confidence` on every
 * segment ✓), and the app never presents the output as certain.
 */

/** One chord the recording was judged to play, and for how long. */
export interface ChordSegment {
  /** The chord, in the app's spelling (`C`, `Am`, `G7`). */
  chord: string
  /** When it started, in seconds from the beginning of the recording. */
  startSec: number
  /** When it stopped. */
  endSec: number
  /** How well the recording matched the template, from 0 to 1. */
  confidence: number
}

/** The knobs of the analysis. */
export interface ChordDetectionOptions {
  /** The samples per analysis window. A power of two. */
  windowSize?: number
  /** How far the window moves between two analyses. */
  hopSize?: number
  /** A chord shorter than this is noise, not a chord. */
  minSegmentSec?: number
  /** The loudest frame below this is silence. */
  silenceFloor?: number
}

const DEFAULT_WINDOW = 4096
const DEFAULT_HOP = 2048
const DEFAULT_MIN_SEGMENT = 0.35
const DEFAULT_SILENCE = 0.01

/** The twelve pitch classes, from C. */
const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

/** The chord templates, as the pitch classes they hold. */
const TEMPLATES: { suffix: string; classes: number[] }[] = [
  { suffix: "", classes: [0, 4, 7] },
  { suffix: "m", classes: [0, 3, 7] },
  { suffix: "7", classes: [0, 4, 7, 10] },
  { suffix: "m7", classes: [0, 3, 7, 10] },
  { suffix: "maj7", classes: [0, 4, 7, 11] },
  { suffix: "sus4", classes: [0, 5, 7] },
  { suffix: "sus2", classes: [0, 2, 7] },
  { suffix: "6", classes: [0, 4, 7, 9] },
  { suffix: "m6", classes: [0, 3, 7, 9] },
  { suffix: "add9", classes: [0, 2, 4, 7] },
  { suffix: "9", classes: [0, 2, 4, 7, 10] },
  { suffix: "dim", classes: [0, 3, 6] },
  { suffix: "aug", classes: [0, 4, 8] },
]

/** The frequency of a pitch class in the octave above middle C. */
const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

/** The frequency of a note, from its name (`A4`, `C#3`, `Bb2`). */
export const noteToFreq = (name: string): number => {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name.trim())
  if (!match) throw new Error(`Not a note: ${name}`)
  const base = PITCH_CLASSES.indexOf(match[1]!)
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0
  const pitchClass = (((base + accidental) % 12) + 12) % 12
  const octave = Number(match[3])
  return midiToFreq(pitchClass + (octave + 1) * 12)
}

/** An in-place radix-2 FFT (the window size must be a power of two). */
const fft = (re: Float64Array, im: Float64Array): void => {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]!
      re[i] = re[j]!
      re[j] = tr
      const ti = im[i]!
      im[i] = im[j]!
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k += 1) {
        const uRe = re[i + k]!
        const uIm = im[i + k]!
        const vRe = re[i + k + len / 2]! * curRe - im[i + k + len / 2]! * curIm
        const vIm = re[i + k + len / 2]! * curIm + im[i + k + len / 2]! * curRe
        re[i + k] = uRe + vRe
        im[i + k] = uIm + vIm
        re[i + k + len / 2] = uRe - vRe
        im[i + k + len / 2] = uIm - vIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

/** The chroma of one window: how much of each of the twelve pitch classes. */
const chromaOf = (
  re: Float64Array,
  im: Float64Array,
  sampleRate: number,
  windowSize: number,
): Float64Array => {
  const chroma = new Float64Array(12)
  const bins = windowSize / 2
  for (let bin = 1; bin < bins; bin += 1) {
    const freq = (bin * sampleRate) / windowSize
    if (freq < 55 || freq > 2200) continue
    const magnitude = Math.hypot(re[bin]!, im[bin]!)
    if (magnitude <= 0) continue
    // The pitch class of the frequency, rounded to the nearest semitone.
    const midi = Math.round(69 + 12 * Math.log2(freq / 440))
    const pitchClass = ((midi % 12) + 12) % 12
    // A gentle tilt: the high notes carry less energy, so they get a little
    // more weight to keep a triad from looking like its bass alone.
    chroma[pitchClass] += magnitude * Math.sqrt(200 / freq)
  }
  return chroma
}

/** The best chord for a chroma, and how well it matched. */
const bestChord = (chroma: Float64Array): { chord: string; confidence: number } => {
  let best = ""
  let bestScore = 0
  let second = 0
  for (const template of TEMPLATES) {
    for (let root = 0; root < 12; root += 1) {
      let score = 0
      for (const step of template.classes) {
        score += chroma[(root + step) % 12]!
      }
      // The longer templates are not better: divide by the square root of
      // their size so a four-note chord is not favoured over a triad.
      score /= Math.sqrt(template.classes.length)
      if (score > bestScore) {
        second = bestScore
        bestScore = score
        best = `${PITCH_CLASSES[root]}${template.suffix}`
      } else if (score > second) {
        second = score
      }
    }
  }
  // The confidence blends the absolute match with the margin over the runner-up.
  const margin = bestScore > 0 ? (bestScore - second) / bestScore : 0
  const confidence = bestScore > 0 ? Math.min(1, 0.6 * Math.min(1, bestScore) + 0.4 * margin) : 0
  return { chord: best, confidence: Math.round(confidence * 100) / 100 }
}

/**
 * Estimates the chords of a recording.
 *
 * The samples are float32 PCM, exactly as the microphone hands them over.
 * The result is a list of chords with their times — an **approximation** the
 * member checks against the music.
 */
export const detectChords = (
  samples: Float32Array,
  sampleRate: number,
  options: ChordDetectionOptions = {},
): ChordSegment[] => {
  const windowSize = options.windowSize ?? DEFAULT_WINDOW
  const hopSize = options.hopSize ?? DEFAULT_HOP
  const minSegmentSec = options.minSegmentSec ?? DEFAULT_MIN_SEGMENT
  const silenceFloor = options.silenceFloor ?? DEFAULT_SILENCE

  if (samples.length < windowSize || sampleRate <= 0) return []

  // The DC offset would otherwise land in the lowest bin and colour the bass.
  let mean = 0
  for (const sample of samples) mean += sample
  mean /= samples.length

  const window = new Float64Array(windowSize)
  for (let i = 0; i < windowSize; i += 1) {
    // A Hann window: it keeps the neighbouring frames from leaking into
    // each other, which is what makes a change of chord land in the right
    // place.
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)))
  }

  const frames: { chord: string; confidence: number; time: number }[] = []
  for (let start = 0; start + windowSize <= samples.length; start += hopSize) {
    const re = new Float64Array(windowSize)
    const im = new Float64Array(windowSize)
    let energy = 0
    for (let i = 0; i < windowSize; i += 1) {
      const value = samples[start + i]! - mean
      energy += value * value
      re[i] = value * window[i]!
    }
    const rms = Math.sqrt(energy / windowSize)
    const time = start / sampleRate
    if (rms < silenceFloor) {
      frames.push({ chord: "", confidence: 0, time })
      continue
    }
    fft(re, im)
    const chroma = chromaOf(re, im, sampleRate, windowSize)
    const match = bestChord(chroma)
    frames.push({ chord: match.chord, confidence: match.confidence, time })
  }

  const segments: ChordSegment[] = []
  for (const frame of frames) {
    const last = segments[segments.length - 1]
    if (last && last.chord === frame.chord) {
      last.endSec = frame.time + hopSize / sampleRate
      last.confidence = Math.max(last.confidence, frame.confidence)
      continue
    }
    segments.push({
      chord: frame.chord,
      startSec: frame.time,
      endSec: frame.time + hopSize / sampleRate,
      confidence: frame.confidence,
    })
  }

  return segments.filter((segment) => {
    if (segment.chord === "") return false
    if (segment.endSec - segment.startSec < minSegmentSec) return false
    return segment.confidence > 0.05
  })
}

/**
 * The key a recording is most likely in: the root of the chord that sounds
 * the most, with the relative minor taken into account.
 */
export const detectKey = (segments: ChordSegment[]): string | null => {
  if (segments.length === 0) return null
  const weight = new Map<string, number>()
  for (const segment of segments) {
    const root = segment.chord.replace(/(m|maj|add|dim|aug|sus)?\d*$/, "")
    if (!root) continue
    weight.set(root, (weight.get(root) ?? 0) + (segment.endSec - segment.startSec))
  }
  let best: string | null = null
  let bestWeight = 0
  for (const [root, total] of weight) {
    if (total > bestWeight) {
      bestWeight = total
      best = root
    }
  }
  return best
}

/**
 * Estimates the tempo of a recording, in beats per minute.
 *
 * The energy of every frame rises where the band hits something; the rhythm
 * is the period that repeats. The autocorrelation of that rise finds it.
 *
 * It is an **approximation** like everything else here: a slow groove and a
 * fast one can be the same recording, and the band plays rubato.
 */
export const detectTempo = (samples: Float32Array, sampleRate: number): number | null => {
  if (samples.length < sampleRate / 4 || sampleRate <= 0) return null

  const frameSize = 1024
  const hop = 512
  const energies: number[] = []
  for (let start = 0; start + frameSize <= samples.length; start += hop) {
    let sum = 0
    for (let i = 0; i < frameSize; i += 1) {
      const value = samples[start + i]!
      sum += value * value
    }
    energies.push(Math.sqrt(sum / frameSize))
  }
  if (energies.length < 16) return null
  const framesPerSecond = sampleRate / hop

  // The rise of the energy: that is where the hits are.
  const onsets = energies.map((value, index) =>
    index === 0 ? 0 : Math.max(0, value - energies[index - 1]!),
  )

  // The peaks of that rise are the hits. They are picked instead of running
  // an autocorrelation because a frame is not a beat: the hits land between
  // two frames and drift, and the **interval between the hits** does not.
  const loudest = onsets.reduce((max, value) => Math.max(max, value), 0)
  if (loudest <= 0) return null
  const threshold = loudest * 0.3
  const peaks: number[] = []
  for (let index = 1; index < onsets.length - 1; index += 1) {
    const value = onsets[index]!
    if (value > threshold && value > onsets[index - 1]! && value >= onsets[index + 1]!) {
      peaks.push(index)
    }
  }
  if (peaks.length < 3) return null

  const intervals: number[] = []
  for (let index = 1; index < peaks.length; index += 1) {
    const gap = peaks[index]! - peaks[index - 1]!
    if (gap > 0) intervals.push(gap)
  }
  if (intervals.length === 0) return null

  const sorted = [...intervals].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1
      ? sorted[middle]!
      : (sorted[middle - 1]! + sorted[middle]!) / 2

  const bpm = (60 * framesPerSecond) / median
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 200) return null
  return Math.round(bpm)
}
