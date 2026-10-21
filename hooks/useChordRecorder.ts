import { useCallback, useRef, useState } from "react"
import { Platform } from "react-native"
import { requestRecordingPermissionsAsync, useAudioStream } from "expo-audio"

import { detectChords, detectKey, type ChordSegment } from "@/libs/chordDetection"

/**
 * Records a passage and estimates the chords (roadmap #85).
 *
 * The microphone hands over float32 PCM in ~100 ms chunks (the same seam the
 * tuner uses ✓), the chunks are kept until the member stops, and the pure
 * core (`libs/chordDetection.ts`) turns the whole recording into chords with
 * their times ✓.
 *
 * Everything happens on the device ✓ and the result is an **approximation** ✓
 * — the confidence travels with every chord ✓, and the screen says so ✓.
 */

export type ChordRecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "analyzing"
  | "done"
  | "error"

export interface ChordRecorder {
  status: ChordRecorderStatus
  /** The chords that were heard, with their times. */
  segments: ChordSegment[]
  /** The key the recording sounds like it is in. */
  key: string | null
  /** True when the platform can record at all. */
  available: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
  reset: () => void
}

export function useChordRecorder(): ChordRecorder {
  const [status, setStatus] = useState<ChordRecorderStatus>("idle")
  const [segments, setSegments] = useState<ChordSegment[]>([])
  const [key, setKey] = useState<string | null>(null)
  // The chunks live in a ref: they are data, not state, and they must not
  // re-render the screen on every 100 ms buffer.
  const chunks = useRef<Float32Array[]>([])
  const sampleRate = useRef(48000)
  const running = useRef(false)

  const { stream } = useAudioStream({
    sampleRate: 48000,
    channels: 1,
    encoding: "float32",
    onBuffer: (buffer) => {
      if (!running.current) return
      sampleRate.current = buffer.sampleRate || sampleRate.current
      chunks.current.push(new Float32Array(buffer.data))
    },
  })

  const start = useCallback(async () => {
    setStatus("requesting")
    setSegments([])
    setKey(null)
    chunks.current = []
    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) {
        setStatus("error")
        return
      }
      await stream.start()
      running.current = true
      setStatus("recording")
    } catch {
      running.current = false
      setStatus("error")
    }
  }, [stream])

  const stop = useCallback(async () => {
    if (!running.current) return
    running.current = false
    try {
      stream.stop()
    } catch {
      // The stream may already be gone; the samples are what matter.
    }
    setStatus("analyzing")
    const total = chunks.current.reduce((sum, chunk) => sum + chunk.length, 0)
    if (total === 0) {
      setStatus("error")
      return
    }
    const samples = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks.current) {
      samples.set(chunk, offset)
      offset += chunk.length
    }
    chunks.current = []
    const found = detectChords(samples, sampleRate.current)
    setSegments(found)
    setKey(detectKey(found))
    setStatus("done")
  }, [stream])

  const reset = useCallback(() => {
    chunks.current = []
    setSegments([])
    setKey(null)
    setStatus("idle")
  }, [])

  return {
    status,
    segments,
    key,
    // The web build of expo-audio has no microphone stream.
    available: Platform.OS !== "web",
    start,
    stop,
    reset,
  }
}
