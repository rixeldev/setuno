/**
 * Tuner microphone seam — web (roadmap #13 spike).
 *
 * expo-audio 57.0.5's `useAudioStream` is a **stub on web** (`stream: null`),
 * so the browser path is built from browser APIs alone — no dependency:
 * `getUserMedia` feeds an `AudioContext`, and a `ScriptProcessorNode` hands the
 * engine ~85 ms of float32 mono per callback.
 *
 * Two deliberate choices:
 * - Browser audio processing is requested **off** (`echoCancellation`,
 *   `noiseSuppression`, `autoGainControl`): all three reshape the waveform,
 *   and a tuner needs the raw signal — a de-noised signal is a *detuned*
 *   signal as far as pitch detection cares.
 * - `ScriptProcessorNode` is deprecated in favour of AudioWorklet, but ships in
 *   every browser unchanged, needs no separate worklet module file (which the
 *   Metro web bundle would have to expose as a URL), and its main-thread
 *   callback is exactly where the engine already runs on native. If the memo's
 *   on-device budget ever fails on web, the AudioWorklet is the upgrade — the
 *   engine contract (`push` chunks) would not change.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type { TunerStream, TunerStreamStatus } from "@/interfaces/tuner"
import { createTunerEngine, type TunerEngine, type TunerReading } from "@/libs/tunerEngine"

type WebTunerRuntime = {
  context: AudioContext
  processor: ScriptProcessorNode
  source: MediaStreamAudioSourceNode
  media: MediaStream
}

export function useTunerStream(): TunerStream {
  const [status, setStatus] = useState<TunerStreamStatus>("idle")
  const [reading, setReading] = useState<TunerReading>(null)
  const [engine] = useState<TunerEngine>(() => createTunerEngine(setReading))
  const runtimeRef = useRef<WebTunerRuntime | null>(null)

  const teardown = useCallback(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    runtimeRef.current = null
    runtime.processor.onaudioprocess = null
    runtime.processor.disconnect()
    runtime.source.disconnect()
    for (const track of runtime.media.getTracks()) track.stop()
    void runtime.context.close()
  }, [])

  const start = useCallback(async () => {
    setStatus("requesting")
    if (!navigator.mediaDevices?.getUserMedia) {
      // No `mediaDevices`: an insecure origin (plain http) or an old browser.
      setStatus("error")
      return
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      // Requesting 48 kHz keeps native and web on the same arithmetic; the
      // engine reads the rate the context actually delivers anyway.
      const context = new AudioContext({ sampleRate: 48000 })
      await context.resume()
      const source = context.createMediaStreamSource(media)
      const processor = context.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer
        // The channel view is reused by the audio thread — the engine needs a
        // copy it can keep in its ring buffer.
        engine.push({
          data: new Float32Array(input.getChannelData(0)),
          sampleRate: input.sampleRate,
          channels: 1,
        })
      }
      source.connect(processor)
      // The processor only fires once it reaches the destination; its output
      // buffer is never written, so nothing is audible and no feedback forms.
      processor.connect(context.destination)
      runtimeRef.current = { context, processor, source, media }
      setStatus("running")
    } catch (error) {
      teardown()
      setStatus(
        error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "error"
      )
    }
  }, [engine, teardown])

  const stop = useCallback(() => {
    teardown()
    engine.reset()
    setReading(null)
    setStatus("idle")
  }, [engine, teardown])

  // Unmount: stop the tracks and close the context; setState after unmount is a
  // no-op in React 18+.
  useEffect(() => () => teardown(), [teardown])

  return { status, reading, start, stop }
}
