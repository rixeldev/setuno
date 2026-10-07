import { useSyncExternalStore } from "react"

/**
 * Height of the app's bottom chrome (tab bar + banner) as reported by the
 * shell. Floating UI (the toast) anchors just above it instead of guessing a
 * constant that breaks when the banner appears or the bar hides.
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
