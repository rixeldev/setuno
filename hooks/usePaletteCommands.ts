import { useEffect, useId } from "react"

import {
  registerPaletteCommands,
  unregisterPaletteCommands,
  type PaletteCommand,
} from "@/libs/commandPalette"

/**
 * Publish `commands` to the command palette (roadmap #29) while the caller is
 * mounted — the reader's transpose, for instance.
 *
 * The palette only reads them when it opens, so this costs no re-render: the
 * commands live in a module map rather than in state, and a screen contributes
 * by simply saying what it has. Re-register with a fresh array whenever the
 * values the commands close over change (the current key, say), so the palette
 * never offers a stale action.
 */
export function usePaletteCommands(commands: readonly PaletteCommand[], enabled = true): void {
  const owner = useId()

  useEffect(() => {
    if (!enabled) return
    registerPaletteCommands(owner, commands)
    return () => unregisterPaletteCommands(owner)
  }, [owner, commands, enabled])
}
