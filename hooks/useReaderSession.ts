import { useSyncExternalStore } from "react"

/**
 * Session state shared while stepping through an event's setlist in the song
 * reader. Each step opens a fresh screen (the reader route is replaced), so:
 *
 * - the last transition direction lives here, letting the stack animate
 *   forwards ("push") or backwards ("pop") depending on the arrow pressed;
 * - stage mode lives here too, so switching songs keeps the reader fullscreen
 *   instead of dropping back to the regular layout;
 * - the live show clock (roadmap #7) lives here as well: the start time and the
 *   break countdown survive the step to the next song, and are kept in memory
 *   only — a show is never written to Firebase.
 */

export type ReaderDirection = "push" | "pop"

let direction: ReaderDirection = "push"
const directionListeners = new Set<() => void>()

export const setReaderDirection = (next: ReaderDirection): void => {
  if (next === direction) return
  direction = next
  directionListeners.forEach((listener) => listener())
}

/** Read by the (app) stack to animate the reader's replace transitions. */
export const useReaderDirection = (): ReaderDirection =>
  useSyncExternalStore(
    (listener) => {
      directionListeners.add(listener)
      return () => {
        directionListeners.delete(listener)
      }
    },
    () => direction,
    () => direction,
  )

let immersive = false

/** Stage mode is only restored when the reader opens inside a setlist. */
export const readImmersiveMode = (): boolean => immersive

export const writeImmersiveMode = (next: boolean): void => {
  immersive = next
}

/** The live show a reader session is running, if any (roadmap #7). */
export interface LiveShowSession {
  /** Setlist the show was started from; null while no show is running. */
  setlistId: string | null
  /** Epoch ms the show started; null while no show is running. */
  startedAt: number | null
  /** Epoch ms the break ends; null when the band is not on a break. */
  breakUntil: number | null
}

const IDLE_SHOW: LiveShowSession = { setlistId: null, startedAt: null, breakUntil: null }

let liveShow: LiveShowSession = IDLE_SHOW
const showListeners = new Set<() => void>()

const notifyShow = (): void => {
  showListeners.forEach((listener) => listener())
}

/** Current live show, or the idle value when the band is not playing one. */
export const readLiveShow = (): LiveShowSession => liveShow

/** Starts (or restarts) the show clock for one setlist. */
export const startLiveShow = (setlistId: string, startedAt: number = Date.now()): void => {
  liveShow = { setlistId, startedAt, breakUntil: null }
  notifyShow()
}

/** Ends the show and forgets the clock. */
export const stopLiveShow = (): void => {
  liveShow = IDLE_SHOW
  notifyShow()
}

/** Starts a break that lasts `seconds` from now. */
export const startBreak = (seconds: number, now: number = Date.now()): void => {
  liveShow = { ...liveShow, breakUntil: now + Math.max(0, seconds) * 1000 }
  notifyShow()
}

/** Ends the break early (or when the countdown reaches zero). */
export const endBreak = (): void => {
  liveShow = { ...liveShow, breakUntil: null }
  notifyShow()
}

/** Live show clock; re-renders on every start/stop/break change. */
export const useLiveShow = (): LiveShowSession =>
  useSyncExternalStore(
    (listener) => {
      showListeners.add(listener)
      return () => {
        showListeners.delete(listener)
      }
    },
    readLiveShow,
    readLiveShow,
  )
