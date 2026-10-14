/**
 * Font-size keyboard shortcuts are a desktop affordance (roadmap #5): on a
 * phone the reader pinches the lyrics or uses the controls in `SongControls`.
 * This native build is intentionally a no-op — the web counterpart lives in
 * `hooks/useFontSizeShortcuts.web.ts` and Metro picks it for `platform=web`.
 */
export const useFontSizeShortcuts = (
  _onDelta: (delta: number) => void,
  _onReset: () => void,
): void => {
  // Nothing to listen to without a keyboard.
}
