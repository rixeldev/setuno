import { useSyncExternalStore } from "react"

/**
 * Height of the app's bottom chrome (the tab bar) as reported by the shell.
 * Floating UI (the toast) anchors just above it instead of guessing a
 * constant that breaks when the bar hides.
 *
 * **The ad banner is not part of it.** The banner's height moves with the
 * fill, the orientation and the SDK's own layout, so a toast that followed it
 * jumped around the screen; the tab bar is the stable part, and the one the
 * toast has to clear. The banner lives *below* the bar, so the toast still
 * never lands on it.
 */

let height = 0
const listeners = new Set<() => void>()

export const setBottomChromeHeight = (next: number): void => {
  const value = Math.max(0, Math.round(next))
  if (value === height) return
  height = value
  listeners.forEach((listener) => listener())
}

export const useBottomChromeHeight = (): number =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => height,
    () => height,
  )
