import { CHORD_SAMPLE_RATE, synthesizeChord, type ChordSound } from "@/libs/chordSynth"

/**
 * Chord preview playback — web (roadmap #14): the roadmap's own prescription
 * ("Web: WebAudio"). The synthesized samples go straight into an
 * `AudioBuffer` — no file round-trip in the browser — through one lazily
 * created `AudioContext`, which is born inside the user's tap and therefore
 * never starts suspended.
 */
let context: AudioContext | null = null
let current: AudioBufferSourceNode | null = null

export function playChord(sound: ChordSound): void {
  try {
    if (typeof window === "undefined" || !window.AudioContext) return
    context ??= new window.AudioContext()
    if (context.state === "suspended") void context.resume()
    const samples = synthesizeChord(sound.midis, sound.timbre)
    if (samples.length === 0) return
    stopChord()
    const buffer = context.createBuffer(1, samples.length, CHORD_SAMPLE_RATE)
    // `.set()` rather than `copyToChannel`: the DOM types demand a
    // `Float32Array<ArrayBuffer>` there, while every Float32Array fills a
    // channel just as well.
    buffer.getChannelData(0).set(samples)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start()
    current = source
  } catch {
    // A preview that fails is a silent tap — never a broken sheet.
  }
}

export function stopChord(): void {
  try {
    current?.stop()
  } catch {
    // The source may already have ended.
  }
  current = null
}
