import { useMemo } from "react"
import { useThemeVersion } from "@/services/themeManager"

/**
 * Builds themed styles once per palette instead of on every render.
 *
 * `factory` is always a module-level `createStyles` function, so it is stable
 * across renders and safe to memoise on. It receives the palette version so a
 * stylesheet can be rebuilt (or, if it ever needs to, branch on) the exact
 * palette in use whenever light/dark or the accent colour changes.
 */
export const useThemedStyles = <T,>(factory: (version: number) => T): T => {
  const version = useThemeVersion()
  return useMemo(() => factory(version), [version, factory])
}