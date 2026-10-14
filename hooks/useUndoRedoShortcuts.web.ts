import { useEffect } from "react"

/**
 * Ctrl/Cmd + Z undoes and Ctrl/Cmd + Shift + Z (or Ctrl + Y) redoes in the song
 * editor (roadmap #25) — the desktop counterpart of the toolbar buttons.
 *
 * The listener is passive about focus: a text field keeps its own native undo
 * while the user is typing a lyric, so the shortcuts only fire when the focus is
 * outside an input/textarea/contenteditable.
 */
export const useUndoRedoShortcuts = (onUndo: () => void, onRedo: () => void): void => {
  useEffect(() => {
    const inTextField = (): boolean => {
      if (typeof document === "undefined") return false
      const active = document.activeElement
      if (!active) return false
      const tag = active.tagName
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (active as HTMLElement).isContentEditable === true
      )
    }

    const handler = (event: KeyboardEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      if (inTextField()) return
      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        onUndo()
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault()
        onRedo()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onUndo, onRedo])
}
