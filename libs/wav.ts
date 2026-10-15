/**
 * 16-bit PCM WAV encoder (roadmap #14).
 *
 * The synthesized chord has to reach `expo-audio`'s player as a file, and a
 * WAV is the one container every platform plays without a codec question.
 * Web never needs it — its seam feeds the samples straight into an
 * `AudioBuffer` — so this file is native-only by nature, though nothing
 * stops it from bundling anywhere.
 *
 * Pure and byte-exact: `tests/unit/wav.test.ts` reads every header field back
 * through a `DataView`, the way a decoder would.
 */

/** Mono float32 (−1..1) → RIFF/WAVE, 16-bit little-endian PCM. */
export function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // format: PCM
  view.setUint16(22, 1, true) // channels: mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, "data")
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]))
    // Symmetric rounding: plain Math.round sends −0.5 to −16383 while +0.5
    // goes to +16384.
    const pcm = value < 0 ? -Math.round(-value * 32767) : Math.round(value * 32767)
    view.setInt16(44 + i * 2, pcm, true)
  }
  return new Uint8Array(buffer)
}
