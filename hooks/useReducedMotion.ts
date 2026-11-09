import { useSystemReducedMotion } from "@/hooks/useSystemReducedMotion"
import { usePreferences } from "@/services/prefs"

/**
 * Whether motion should be suppressed. Two independent switches ask for it:
 * the member's own "reduce motion" preference (Settings → Reader) and the
 * operating system's accessibility setting. Either one is enough.
 *
 * Callers still animate — they just jump to the final value in one frame — so
 * an overlay never depends on an animation to become visible.
 */
export function useReducedMotion(): boolean {
  const system = useSystemReducedMotion()
  const preference = usePreferences().reduceMotion
  return preference || system
}
