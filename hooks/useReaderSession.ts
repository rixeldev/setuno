import { useSyncExternalStore } from "react"

/**
 * Session state shared while stepping through an event's setlist in the song
 * reader. Each step opens a fresh screen (the reader route is replaced), so:
 *
 * - the last transition direction lives here, letting the stack animate
 *   forwards ("push") or backwards ("pop") depending on the arrow pressed;
 * - stage mode lives here too, so switching songs keeps the reader fullscreen
 *   instead of dropping back to the regular layout.
 */

export type ReaderDirection = "push" | "pop"

let direction: ReaderDirection = "push"
const listeners = new Set<() => void>()

export const setReaderDirection = (next: ReaderDirection): void => {
  if (next === direction) return
  direction = next
  listeners.forEach((listener) => listener())
}

/** Read by the (app) stack to animate the reader's replace transitions. */
export const useReaderDirection = (): ReaderDirection =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
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
