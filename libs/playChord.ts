import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio"
import { File, Paths } from "expo-file-system"

import { CHORD_SAMPLE_RATE, synthesizeChord, type ChordSound } from "@/libs/chordSynth"
import { encodeWav16 } from "@/libs/wav"

/**
 * Chord preview playback — native (roadmap #14, "hear the chord").
 *
 * The evaluation the roadmap asked for ("the simplest reliable path"):
 * **no new dependency.** The chord is synthesized in pure JS
 * (`libs/chordSynth.ts`), encoded as a 16-bit WAV (`libs/wav.ts`) into the
 * cache and played through the same `expo-audio` player the metronome already
 * proved on every platform. Web (`playChord.web.ts`) skips the file entirely
 * and feeds an `AudioBuffer` instead — the synthesis, which carries all the
 * opinions, stays shared.
 */
const FILE_NAME = "setuno-chord.wav"

// The player is a module singleton kept for the app's life, like the
// metronome's clicks: one small WAV on disk, one native player, a `replace()`
// per preview.
let player: AudioPlayer | null = null

export function playChord(sound: ChordSound): void {
  try {
    const samples = synthesizeChord(sound.midis, sound.timbre)
    if (samples.length === 0) return
    const file = new File(Paths.cache, FILE_NAME)
    if (file.exists) file.delete()
    file.create()
    file.write(encodeWav16(samples, CHORD_SAMPLE_RATE))
    player ??= createAudioPlayer()
    player.replace({ uri: file.uri })
    player.play()
    // Same tolerance the metronome has: sound on iOS even with the silent
    // switch on; a failed mode change only costs the preview, never the tap.
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined)
  } catch {
    // A preview that fails is a silent tap — never a broken sheet.
  }
}

export function stopChord(): void {
  try {
    player?.pause()
    player?.seekTo(0)
  } catch {
    // Same contract as playChord.
  }
}
