import { useEffect } from "react"

/**
 * Desktop keyboard control for the reader (roadmap #8): arrows, space and
 * PageUp/PageDown step through an event's setlist, up/down transpose, `f`
 * toggles stage mode, `p` toggles autoscroll and Escape leaves stage mode.
 *
 * The same keys are what Bluetooth page-turner pedals (AirTurn, iRig BlueTurn,
 * Donner…) send over HID: they emulate PageUp/PageDown or the arrow keys, so a
 * pedal needs no special support — plug it in and it turns the page.
 *
 * Keys are ignored while a text field is focused (so the editor and the comment
 * boxes keep working) and while a modifier is held (so Ctrl/Cmd shortcuts —
 * font size, browser find — stay untouched). `enabled` lets the reader mute the
 * keys while a sheet or dialog is open over it.
 */
export interface ReaderKeyHandlers {
  enabled: boolean
  onNext: (() => void) | null
  onPrevious: (() => void) | null
  onTranspose: (delta: number) => void
  onToggleStage: () => void
  onExitStage: () => void
  onToggleAutoscroll: () => void
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null
  if (!element) return false
  if (element.isContentEditable) return true
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT"
}

export const useReaderKeys = ({
  enabled,
  onNext,
  onPrevious,
  onTranspose,
  onToggleStage,
  onExitStage,
  onToggleAutoscroll,
}: ReaderKeyHandlers): void => {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
        case "Spacebar":
          if (onNext) {
            event.preventDefault()
            onNext()
          }
          return
        case "ArrowLeft":
        case "PageUp":
          if (onPrevious) {
            event.preventDefault()
            onPrevious()
          }
          return
        case "ArrowUp":
        case "+":
        case "=":
          event.preventDefault()
          onTranspose(1)
          return
        case "ArrowDown":
        case "-":
        case "_":
          event.preventDefault()
          onTranspose(-1)
          return
        case "f":
        case "F":
          event.preventDefault()
          onToggleStage()
          return
        case "p":
        case "P":
          event.preventDefault()
          onToggleAutoscroll()
          return
        case "Escape":
          onExitStage()
          return
        default:
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [enabled, onNext, onPrevious, onTranspose, onToggleStage, onExitStage, onToggleAutoscroll])
}
