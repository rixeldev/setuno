import { describe, expect, it } from "vitest"

import { detectChords, detectKey, noteToFreq } from "@/libs/chordDetection"

const SAMPLE_RATE = 44100

/** A simple additive synth: one sine per note. */
const play = (notes: string[], seconds: number, sampleRate = SAMPLE_RATE): Float32Array => {
  const total = Math.floor(seconds * sampleRate)
  const out = new Float32Array(total)
  const freqs = notes.map(noteToFreq)
  for (let i = 0; i < total; i += 1) {
    let value = 0
    for (const freq of freqs) value += Math.sin((2 * Math.PI * freq * i) / sampleRate)
    out[i] = value / freqs.length
  }
  return out
}

/** One chord after another. */
const playAll = (chords: string[][], seconds: number): Float32Array => {
  const parts = chords.map((notes) => play(notes, seconds))
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

describe("detectChords", () => {
  it("hears a C major triad", () => {
    const segments = detectChords(play(["C4", "E4", "G4"], 1.5), SAMPLE_RATE)

    expect(segments.length).toBeGreaterThan(0)
    expect(segments[0]?.chord).toBe("C")
    expect(segments[0]?.confidence).toBeGreaterThan(0.5)
  })

  it("hears an A minor triad", () => {
    const segments = detectChords(play(["A3", "C4", "E4"], 1.5), SAMPLE_RATE)

    expect(segments[0]?.chord).toBe("Am")
  })

  it("hears a seventh chord as a seventh", () => {
    const segments = detectChords(play(["G3", "B3", "D4", "F4"], 1.5), SAMPLE_RATE)

    expect(segments[0]?.chord).toBe("G7")
  })

  it("follows a progression", () => {
    const segments = detectChords(
      playAll(
        [
          ["C4", "E4", "G4"],
          ["G3", "B3", "D4"],
        ],
        1,
      ),
      SAMPLE_RATE,
    )

    const chords = segments.map((segment) => segment.chord)
    expect(chords[0]).toBe("C")
    expect(chords[chords.length - 1]).toBe("G")
    // The first chord is over before the second one starts.
    expect(segments[0]!.endSec).toBeLessThan(segments[segments.length - 1]!.startSec)
  })

  it("says nothing about silence", () => {
    const segments = detectChords(new Float32Array(SAMPLE_RATE), SAMPLE_RATE)

    expect(segments).toEqual([])
  })

  it("says nothing about a recording too short to read", () => {
    const segments = detectChords(play(["C4", "E4", "G4"], 0.02), SAMPLE_RATE)

    expect(segments).toEqual([])
  })
})

describe("detectKey", () => {
  it("names the key of a progression", () => {
    const segments = detectChords(
      playAll(
        [
          ["C4", "E4", "G4"],
          ["C4", "E4", "G4"],
          ["G3", "B3", "D4"],
        ],
        1,
      ),
      SAMPLE_RATE,
    )

    expect(detectKey(segments)).toBe("C")
  })

  it("has nothing to say about an empty recording", () => {
    expect(detectKey([])).toBeNull()
  })
})

describe("noteToFreq", () => {
  it("knows the notes", () => {
    expect(Math.round(noteToFreq("A4"))).toBe(440)
    expect(Math.round(noteToFreq("C4"))).toBe(262)
    expect(Math.round(noteToFreq("A3"))).toBe(220)
  })

  it("knows the sharps and the flats", () => {
    expect(Math.round(noteToFreq("C#4"))).toBe(277)
    expect(Math.round(noteToFreq("Db4"))).toBe(277)
  })
})
