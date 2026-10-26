import { useEffect } from "react"
import { Dimensions, Platform } from "react-native"
import * as ScreenOrientation from "expo-screen-orientation"

import { isTabletViewport } from "@/libs/deviceClass"

/**
 * Phones stay portrait; tablets may rotate freely. The manifest is locked to
 * portrait, so on Android the tablet unlock is the only thing that ever permits
 * landscape — a failure here keeps a tablet in portrait (graceful degradation),
 * never a phone in landscape.
 */
export const useTabletOrientation = (): void => {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { width, height } = Dimensions.get("window")
        const isTablet =
          Platform.OS === "ios"
            ? Platform.isPad === true
            : isTabletViewport(width, height)
        if (cancelled) return
        if (isTablet) {
          await ScreenOrientation.unlockAsync()
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        }
      } catch {
        // The manifest's portrait lock remains in effect.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
}