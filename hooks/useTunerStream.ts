/**
 * Tuner microphone seam — native (roadmap #13 spike).
 *
 * `useAudioStream` (expo-audio, SDK 57) delivers float32 PCM from the mic in
 * ~100 ms chunks straight to the JS thread: Android reads `AudioRecord` at
 * `sampleRate * 0.1` bytes per iteration with fallback rates the hardware
 * chooses; iOS taps `AVAudioEngine` at `sampleRate * 0.1` frames and converts.
 * Both hand over the *actual* rate per buffer, which is why the engine reads
 * `chunk.sampleRate` instead of trusting the request.
 *
 * The web implementation of `useAudioStream` in expo-audio 57.0.5 is a stub
 * (`stream: null`) — browsers get `useTunerStream.web.ts` instead.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { requestRecordingPermissionsAsync, useAudioStream } from "expo-audio"

import type { TunerStream, TunerStreamStatus } from "@/interfaces/tuner"
import { createTunerEngine, type TunerEngine, type TunerReading } from "@/libs/tunerEngine"

export function useTunerStream(): TunerStream {
  const [status, setStatus] = useState<TunerStreamStatus>("idle")
  const [reading, setReading] = useState<TunerReading>(null)
  // The engine is created once and calls the stable setState directly; it holds
  // no React state of its own, so a lazy useState initializer is the whole
  // lifecycle (never `useRef(initial).current` — the React lint bans it).
  const [engine] = useState<TunerEngine>(() => createTunerEngine(setReading))
  const streamingRef = useRef(false)

  const { stream } = useAudioStream({
    sampleRate: 48000,
    channels: 1,
    encoding: "float32",
    onBuffer: (buffer) => {
      engine.push({ data: buffer.data, sampleRate: buffer.sampleRate, channels: buffer.channels })
    },
  })

  const start = useCallback(async () => {
    setStatus("requesting")
    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) {
        setStatus("denied")
        return
      }
      await stream.start()
      streamingRef.current = true
      setStatus("running")
    } catch {
      // The mic is held by another app, the device has none, or the stream
      // failed to initialize — all three read as "unavailable" to the user.
      streamingRef.current = false
      setStatus("error")
    }
  }, [stream])

  const stop = useCallback(() => {
    if (streamingRef.current) {
      streamingRef.current = false
      stream.stop()
    }
    engine.reset()
    setReading(null)
    setStatus("idle")
  }, [engine, stream])

  // Unmount: release the native audio resources; setState after unmount is a
  // no-op in React 18+, and the engine dies with the closure anyway.
  useEffect(
    () => () => {
      if (streamingRef.current) {
        streamingRef.current = false
        stream.stop()
      }
    },
    [stream]
  )

  return { status, reading, start, stop }
}
