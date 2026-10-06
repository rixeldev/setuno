import React, { useEffect, useState } from "react"
import { Animated, Easing, Platform, StyleSheet, View } from "react-native"

import { StartupSplash } from "@/components/app/StartupSplash"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { isBootResolved } from "@/libs/boot"

/** The loading animation never blinks: the splash stays at least this long. */
const MIN_SPLASH_MS = 900
/** Safety valve: a band that never answers must not trap the user on the splash. */
const BOOT_TIMEOUT_MS = 5000
const FADE_MS = 320

/**
 * Holds the animated splash until the app has finished loading (auth, band
 * list and the first slice of band data — see `isBootResolved`), then fades it
 * out over the already-mounted app so there is no blank frame in between.
 */
export function StartupGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const { state } = useOrganization()
  const { loading: organizationDataLoading } = useOrgData()

  const booted = isBootResolved({
    authStatus: status,
    organizationState: state,
    organizationDataLoading,
  })

  const [minElapsed, setMinElapsed] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [released, setReleased] = useState(false)
  const [opacity] = useState(() => new Animated.Value(1))

  useEffect(() => {
    const minimum = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS)
    const deadline = setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS)
    return () => {
      clearTimeout(minimum)
      clearTimeout(deadline)
    }
  }, [])

  const ready = (booted || timedOut) && minElapsed
  // Derived: the app mounts in the same commit the fade starts, already loaded
  // underneath the splash.
  const renderApp = ready

  useEffect(() => {
    if (!ready) return
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      delay: 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (finished) setReleased(true)
    })
  }, [opacity, ready])

  return (
    <View style={styles.host}>
      {renderApp ? children : null}
      {released ? null : (
        <Animated.View
          style={[styles.splash, { opacity, pointerEvents: renderApp ? "none" : "auto" }]}
        >
          <StartupSplash />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  splash: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
})
