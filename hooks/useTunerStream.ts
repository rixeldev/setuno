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

import { useCallback, useRef, useState } from "react"
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

  /**
   * `AudioStream.stop()` is typed `void`, but expo-modules-core routes it
   * through an **async** native call: when the shared object has already been
   * released the call *rejects*, and an unhandled rejection is fatal in a
   * release build (v1.1.0 crashed exactly this way on the way out of the
   * tuner). Stopping something that is already gone is not an error here.
   */
  const stopStream = useCallback(() => {
    try {
      const pending: unknown = stream.stop()
      if (pending instanceof Promise) void pending.catch(() => undefined)
    } catch {
      // Released already: nothing left to stop.
    }
  }, [stream])

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
      // The mic is held by another app, the device has none, the stream failed
      // to initialize, or the screen was left while the permission dialog was
      // up (the stream is released by then) — all read as "unavailable".
      streamingRef.current = false
      setStatus("error")
    }
  }, [stream])

  const stop = useCallback(() => {
    if (streamingRef.current) {
      streamingRef.current = false
      stopStream()
    }
    engine.reset()
    setReading(null)
    setStatus("idle")
  }, [engine, stopStream])

  // **No `stop()` on unmount, on purpose.** `useAudioStream` releases its
  // shared object when this component unmounts, and that release stops the
  // capture by itself (`sharedObjectDidRelease` → `stop()` on Android, `deinit`
  // on iOS). Its cleanup is registered before this hook's own effects, so it
  // runs first: a `stop()` here would always target an already released
  // object. setState after unmount is a no-op in React 18+, and the engine
  // dies with the closure anyway.

  return { status, reading, start, stop }
}
