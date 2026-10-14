import { useCallback, useMemo, useState } from "react"

import {
  DEFAULT_COALESCE_MS,
  DEFAULT_HISTORY_LIMIT,
  canRedo as canRedoState,
  canUndo as canUndoState,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryOptions,
  type HistoryState,
} from "@/libs/history"

export type UndoRedoOptions = HistoryOptions

export interface UndoRedo<T> {
  value: T
  set: (next: T | ((current: T) => T)) => void
  /** Replaces the value and clears the history (loading another song). */
  reset: (next: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Number of steps available to undo (for tests / accessibility). */
  depth: number
}

/**
 * In-memory undo/redo (roadmap #25).
 *
 * The lyric/chord editor edits are frequent and fine-grained, so consecutive
 * changes coalesce into one step (a burst of typing is a single undo); anything
 * after a pause, an undo or a redo starts a fresh step. The stack is capped and
 * lives only for the lifetime of the screen — nothing is persisted.
 */
export function useUndoRedo<T>(initial: T, options: UndoRedoOptions = {}): UndoRedo<T> {
  const { coalesceMs = DEFAULT_COALESCE_MS, limit = DEFAULT_HISTORY_LIMIT } = options
  const [history, setHistory] = useState<HistoryState<T>>(() => createHistory(initial))

  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      const now = Date.now()
      setHistory((current) => {
        const value =
          typeof next === "function" ? (next as (present: T) => T)(current.present) : next
        return pushHistory(current, value, now, { coalesceMs, limit })
      })
    },
    [coalesceMs, limit],
  )

  const reset = useCallback((next: T) => {
    setHistory(createHistory(next))
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => undoHistory(current, { limit }))
  }, [limit])

  const redo = useCallback(() => {
    setHistory((current) => redoHistory(current, { limit }))
  }, [limit])

  return useMemo(
    () => ({
      value: history.present,
      set,
      reset,
      undo,
      redo,
      canUndo: canUndoState(history),
      canRedo: canRedoState(history),
      depth: history.past.length,
    }),
    [history, set, reset, undo, redo],
  )
}
