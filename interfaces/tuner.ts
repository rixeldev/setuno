import type { TunerReading } from "@/libs/tunerEngine"

/**
 * Contract of the tuner's microphone seam (roadmap #13 spike).
 *
 * Two implementations share it: `hooks/useTunerStream.ts` (native, expo-audio's
 * `useAudioStream`) and `hooks/useTunerStream.web.ts` (browser, `getUserMedia`
 * + `ScriptProcessorNode`) — Metro picks the right one, the screen never knows.
 */
export type TunerStreamStatus =
  /** Nobody asked for the microphone yet. */
  | "idle"
  /** The OS/browser permission dialog is up. */
  | "requesting"
  /** The user said no (or the OS locked it out). */
  | "denied"
  /** Chunks are flowing; readings update. */
  | "running"
  /** The mic is unavailable (held by another app, no device, insecure origin). */
  | "error"

export type TunerStream = {
  status: TunerStreamStatus
  reading: TunerReading
  /** Requests the microphone and starts the stream. Never throws. */
  start: () => Promise<void>
  /** Stops the stream and clears the reading. */
  stop: () => void
}
