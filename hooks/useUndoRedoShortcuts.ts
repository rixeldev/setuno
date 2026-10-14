/**
 * Undo/redo keyboard shortcuts are a desktop affordance (roadmap #25): on a
 * phone the editor uses the toolbar buttons. This native build is intentionally
 * a no-op — the web counterpart lives in `hooks/useUndoRedoShortcuts.web.ts` and
 * Metro picks it for `platform=web`.
 */
export const useUndoRedoShortcuts = (_onUndo: () => void, _onRedo: () => void): void => {
  // Nothing to listen to without a keyboard.
}
