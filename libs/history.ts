/**
 * Pure undo/redo history (roadmap #25).
 *
 * Kept out of the React hook so the stack behaviour — capping, coalescing,
 * undo/redo bookkeeping — is unit-testable without a renderer. The hook
 * (`hooks/useUndoRedo.ts`) is a thin `useState` wrapper around these functions.
 */

export interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
  /** Timestamp of the last recorded edit, used for coalescing. */
  lastEditAt: number
}

export interface HistoryOptions {
  /** Maximum number of snapshots kept; the oldest are dropped. */
  limit?: number
  /**
   * Edits closer together than this merge into a single history step, so
   * typing a lyric does not push one entry per keystroke.
   */
  coalesceMs?: number
}

export const DEFAULT_HISTORY_LIMIT = 100
export const DEFAULT_COALESCE_MS = 600

/** A fresh history holding one value and nothing to undo or redo. */
export const createHistory = <T>(present: T): HistoryState<T> => ({
  past: [],
  present,
  future: [],
  lastEditAt: 0,
})

/**
 * Records a new value. A change made within `coalesceMs` of the previous one
 * (and with something already on the stack) replaces the current step instead of
 * pushing a new one; anything else starts a fresh step and drops the redo queue.
 */
export const pushHistory = <T>(
  state: HistoryState<T>,
  value: T,
  now: number,
  options: HistoryOptions = {},
): HistoryState<T> => {
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT
  const coalesceMs = options.coalesceMs ?? DEFAULT_COALESCE_MS
  if (Object.is(value, state.present)) return state
  const coalesce = now - state.lastEditAt < coalesceMs && state.past.length > 0
  const past = coalesce ? state.past : [...state.past, state.present].slice(-limit)
  return { past, present: value, future: [], lastEditAt: now }
}

/** Steps back one entry; the current value moves onto the redo queue. */
export const undoHistory = <T>(
  state: HistoryState<T>,
  options: HistoryOptions = {},
): HistoryState<T> => {
  if (state.past.length === 0) return state
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT
  const previous = state.past[state.past.length - 1] as T
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, limit),
    // A following edit must not coalesce with the step we just returned to.
    lastEditAt: 0,
  }
}

/** Steps forward one entry; the value moves back onto the undo stack. */
export const redoHistory = <T>(
  state: HistoryState<T>,
  options: HistoryOptions = {},
): HistoryState<T> => {
  if (state.future.length === 0) return state
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT
  const [next, ...rest] = state.future as [T, ...T[]]
  return {
    past: [...state.past, state.present].slice(-limit),
    present: next,
    future: rest,
    lastEditAt: 0,
  }
}

export const canUndo = <T>(state: HistoryState<T>): boolean => state.past.length > 0
export const canRedo = <T>(state: HistoryState<T>): boolean => state.future.length > 0
