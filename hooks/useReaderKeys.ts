/**
 * Reader keyboard control is a desktop affordance (roadmap #8): a physical
 * keyboard or a Bluetooth page-turner pedal is only meaningful on web/desktop.
 * This native build is intentionally a no-op — the web counterpart lives in
 * `hooks/useReaderKeys.web.ts` and Metro picks it for `platform=web`.
 *
 * Native key events would need a native module (a research spike, not part of
 * this milestone), so on a phone the reader keeps stepping with the corner
 * arrows.
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

export const useReaderKeys = (_handlers: ReaderKeyHandlers): void => {
  // Nothing to listen to without a keyboard.
}
