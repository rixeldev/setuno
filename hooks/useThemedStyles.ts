import { useMemo } from "react"
import { useThemeVersion } from "@/services/themeManager"

export const useThemedStyles = <T,>(factory: () => T): T => {
  const version = useThemeVersion()
  return useMemo(factory, [version])
}