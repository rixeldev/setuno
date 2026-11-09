import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

/**
 * The OS-level "reduce motion" switch (iOS Settings → Accessibility, Android
 * Remove animations). The answer is read in the background and then kept in
 * step with a subscription, so a platform that answers slowly never makes the
 * first frame flicker.
 */
export function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let active = true
    // The promise callback owns the state — never the effect body — because the
    // React Compiler lint rejects a synchronous setState while an effect runs.
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value)
      })
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      if (active) setReduced(value)
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return reduced
}
