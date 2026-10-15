import { describe, expect, it } from "vitest"

import { createTunerEngine, TUNER_HOLD_PUSHES, type TunerReading } from "@/libs/tunerEngine"

/** A native-shaped chunk: ~100 ms of 48 kHz float32, like expo-audio delivers. */
function sineChunk(
  frequency: number,
  options: { sampleRate?: number; channels?: number; seconds?: number; amplitude?: number } = {}
): { data: Float32Array; sampleRate: number; channels: number } {
  const sampleRate = options.sampleRate ?? 48000
  const channels = options.channels ?? 1
  const frames = Math.floor(sampleRate * (options.seconds ?? 0.1))
  const amplitude = options.amplitude ?? 0.5
  const data = new Float32Array(frames * channels)
  for (let frame = 0; frame < frames; frame++) {
    const value = amplitude * Math.sin((2 * Math.PI * frequency * frame) / sampleRate)
    for (let channel = 0; channel < channels; channel++) {
      data[frame * channels + channel] = value
    }
  }
  return { data, sampleRate, channels }
}

function silenceChunk(sampleRate = 48000): { data: Float32Array; sampleRate: number; channels: number } {
  return { data: new Float32Array(Math.floor(sampleRate * 0.1)), sampleRate, channels: 1 }
}

function collect() {
  const readings: TunerReading[] = []
  return { readings, engine: createTunerEngine((reading) => readings.push(reading)) }
}

describe("tunerEngine", () => {
  it("needs one window of audio before reading anything", () => {
    const { readings, engine } = collect()
    engine.push(sineChunk(440, { seconds: 0.02 }))
    expect(readings).toHaveLength(0)
  })

  it("reads a stable A4 from native-shaped 48 kHz chunks", () => {
    const { readings, engine } = collect()
    for (let i = 0; i < 8; i++) engine.push(sineChunk(440))
    const last = readings.at(-1)
    expect(last).not.toBeNull()
    expect(last!.name).toBe("A")
    expect(last!.octave).toBe(4)
    expect(Math.abs(last!.cents)).toBeLessThan(5)
    expect(last!.frequency).toBeGreaterThan(439)
    expect(last!.frequency).toBeLessThan(441)
    expect(last!.analysisMs).toBeGreaterThanOrEqual(0)
  })

  it("reads the bass low E from the same cadence", () => {
    const { readings, engine } = collect()
    for (let i = 0; i < 8; i++) engine.push(sineChunk(82.41))
    const last = readings.at(-1)
    expect(last!.name).toBe("E")
    expect(last!.octave).toBe(2)
    expect(Math.abs(last!.cents)).toBeLessThan(5)
  })

  it("holds the reading through a string's decay, then blanks", () => {
    const { readings, engine } = collect()
    for (let i = 0; i < 4; i++) engine.push(sineChunk(440))
    const tuned = readings.at(-1)!
    expect(tuned.name).toBe("A")

    const countAtDecay = readings.length
    for (let i = 0; i < TUNER_HOLD_PUSHES; i++) engine.push(silenceChunk())
    const held = readings.slice(countAtDecay)
    expect(held).toHaveLength(TUNER_HOLD_PUSHES)
    for (const reading of held) {
      expect(reading?.name).toBe("A")
    }

    engine.push(silenceChunk())
    expect(readings.at(-1)).toBeNull()
  })

  it("reports silence as null from the very first chunk", () => {
    const { readings, engine } = collect()
    for (let i = 0; i < 6; i++) engine.push(silenceChunk())
    expect(readings.length).toBeGreaterThan(0)
    expect(readings.at(-1)).toBeNull()
  })

  it("mixes interleaved stereo down to mono", () => {
    const { readings, engine } = collect()
    for (let i = 0; i < 8; i++) engine.push(sineChunk(220, { channels: 2 }))
    const last = readings.at(-1)
    expect(last!.name).toBe("A")
    expect(last!.octave).toBe(3)
    expect(Math.abs(last!.cents)).toBeLessThan(5)
  })

  it("smooths a single glitched frame out of the display", () => {
    const { readings, engine } = collect()
    for (let i = 0; i < 6; i++) engine.push(sineChunk(440))
    engine.push(sineChunk(442))
    const last = readings.at(-1)!
    expect(last.name).toBe("A")
    expect(Math.abs(last.cents)).toBeLessThan(10)
  })

  it("survives a chunk larger than its whole window", () => {
    const { readings, engine } = collect()
    engine.push(sineChunk(440, { seconds: 0.5 }))
    engine.push(sineChunk(440, { seconds: 0.5 }))
    const last = readings.at(-1)
    expect(last?.name).toBe("A")
  })

  it("reset forgets the history", () => {
    const { readings, engine } = collect()
    for (let i = 0; i < 4; i++) engine.push(sineChunk(440))
    engine.reset()
    // The next chunk starts cold: no held reading survives the reset.
    engine.push(silenceChunk())
    expect(readings.at(-1)).toBeNull()
  })

  it("ignores malformed chunks instead of throwing", () => {
    const { readings, engine } = collect()
    engine.push({ data: new Float32Array(0), sampleRate: 48000, channels: 1 })
    engine.push({ data: new Float32Array(4800), sampleRate: 0, channels: 1 })
    expect(readings).toHaveLength(0)
  })
})
