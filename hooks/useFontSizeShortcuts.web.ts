import { useEffect } from "react"

/**
 * Ctrl/Cmd + `+` / `-` resizes the reader text and Ctrl/Cmd + `0` restores the
 * profile default (roadmap #5) — the desktop counterpart of the pinch gesture.
 * Both the `+`/`=` and `-`/`_` spellings are accepted, since `+` needs Shift on
 * most layouts.
 */
export const useFontSizeShortcuts = (
  onDelta: (delta: number) => void,
  onReset: () => void,
): void => {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        onDelta(1)
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault()
        onDelta(-1)
      } else if (event.key === "0") {
        event.preventDefault()
        onReset()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onDelta, onReset])
}
