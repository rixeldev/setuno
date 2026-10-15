import { describe, expect, it } from "vitest"

import { encodeWav16 } from "@/libs/wav"

const ascii = (view: DataView, offset: number, length: number): string =>
  Array.from({ length }, (_, i) => view.getUint8(offset + i))
    .map((byte) => String.fromCharCode(byte))
    .join("")

describe("encodeWav16", () => {
  it("writes a RIFF/WAVE header a decoder can read back", () => {
    const samples = new Float32Array(3)
    const bytes = encodeWav16(samples, 48000)
    expect(bytes.length).toBe(44 + 3 * 2)
    const view = new DataView(bytes.buffer)

    expect(ascii(view, 0, 4)).toBe("RIFF")
    expect(view.getUint32(4, true)).toBe(36 + 6) // file size after this field
    expect(ascii(view, 8, 4)).toBe("WAVE")
    expect(ascii(view, 12, 4)).toBe("fmt ")
    expect(view.getUint32(16, true)).toBe(16) // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1) // format: PCM
    expect(view.getUint16(22, true)).toBe(1) // channels: mono
    expect(view.getUint32(24, true)).toBe(48000)
    expect(view.getUint32(28, true)).toBe(96000) // byte rate: mono, 16-bit
    expect(view.getUint16(32, true)).toBe(2) // block align
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(ascii(view, 36, 4)).toBe("data")
    expect(view.getUint32(40, true)).toBe(6)
  })

  it("round-trips floats symmetrically, clamping past full scale", () => {
    const input = Float32Array.from([0, 1, -1, 0.5, -0.5, 2, -2])
    const bytes = encodeWav16(input, 44100)
    const view = new DataView(bytes.buffer)
    const output = Array.from({ length: input.length }, (_, i) => view.getInt16(44 + i * 2, true))

    expect(output).toEqual([0, 32767, -32767, 16384, -16384, 32767, -32767])
  })

  it("keeps a valid header for silence and for nothing at all", () => {
    const silent = encodeWav16(new Float32Array(4), 44100)
    const view = new DataView(silent.buffer)
    expect(ascii(view, 0, 4)).toBe("RIFF")
    expect(view.getUint32(40, true)).toBe(8)

    const empty = encodeWav16(new Float32Array(0), 44100)
    const emptyView = new DataView(empty.buffer)
    expect(empty.length).toBe(44)
    expect(emptyView.getUint32(4, true)).toBe(36)
    expect(emptyView.getUint32(40, true)).toBe(0)
  })
})
