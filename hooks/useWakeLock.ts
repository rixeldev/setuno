import { useEffect } from "react"
import { AppState } from "react-native"

import { acquireWakeLock, releaseWakeLock } from "@/libs/wakeLock"

/**
 * Holds a screen wake lock while `enabled` is true (roadmap #2).
 *
 * It is dropped on background and taken again when the app (native) or the tab
 * (web) returns to the foreground, so a paused reader never keeps the device
 * awake behind the user's back — and the web build recovers the lock the
 * browser released on its own when the tab was hidden.
 */
export const useWakeLock = (enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return
    void acquireWakeLock()
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void acquireWakeLock()
      else void releaseWakeLock()
    })
    return () => {
      subscription.remove()
      void releaseWakeLock()
    }
  }, [enabled])
}
