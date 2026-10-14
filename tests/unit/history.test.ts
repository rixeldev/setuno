import { describe, expect, it } from "vitest"

import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "@/libs/history"

describe("history", () => {
  it("starts with nothing to undo or redo", () => {
    const state = createHistory("a")
    expect(state.present).toBe("a")
    expect(canUndo(state)).toBe(false)
    expect(canRedo(state)).toBe(false)
  })

  it("records a step and undoes back to it", () => {
    let state = createHistory("a")
    state = pushHistory(state, "b", 1000)
    expect(state.present).toBe("b")
    expect(canUndo(state)).toBe(true)

    state = undoHistory(state)
    expect(state.present).toBe("a")
    expect(canUndo(state)).toBe(false)
    expect(canRedo(state)).toBe(true)

    state = redoHistory(state)
    expect(state.present).toBe("b")
    expect(canRedo(state)).toBe(false)
  })

  it("ignores a no-op change", () => {
    const state = createHistory("a")
    expect(pushHistory(state, "a", 1000)).toBe(state)
  })

  it("coalesces quick successive edits into one step", () => {
    let state = createHistory("")
    state = pushHistory(state, "h", 1000)
    state = pushHistory(state, "he", 1200)
    state = pushHistory(state, "hel", 1400)
    expect(state.past).toEqual([""])
    expect(state.present).toBe("hel")

    state = undoHistory(state)
    expect(state.present).toBe("")
  })

  it("starts a new step after the coalescing window", () => {
    let state = createHistory("")
    state = pushHistory(state, "h", 1000)
    state = pushHistory(state, "hello", 5000)
    expect(state.past).toEqual(["", "h"])

    state = undoHistory(state)
    expect(state.present).toBe("h")
  })

  it("does not coalesce an edit made right after an undo", () => {
    let state = createHistory("a")
    state = pushHistory(state, "b", 1000)
    state = pushHistory(state, "c", 9000)
    state = undoHistory(state)
    expect(state.present).toBe("b")
    // Still within the window of the pre-undo edit, but undo reset the clock.
    state = pushHistory(state, "d", 9100)
    expect(state.present).toBe("d")
    state = undoHistory(state)
    expect(state.present).toBe("b")
  })

  it("drops the redo queue once a new edit is made", () => {
    let state = createHistory("a")
    state = pushHistory(state, "b", 1000)
    state = undoHistory(state)
    expect(canRedo(state)).toBe(true)
    state = pushHistory(state, "c", 9000)
    expect(canRedo(state)).toBe(false)
  })

  it("caps the stack at the limit", () => {
    const limit = 3
    let state = createHistory(0)
    for (let value = 1; value <= 10; value += 1) {
      state = pushHistory(state, value, value * 10000, { limit })
    }
    expect(state.past).toHaveLength(limit)
    expect(state.present).toBe(10)

    for (let step = 0; step < 10; step += 1) state = undoHistory(state, { limit })
    // Only the last `limit` steps are reachable.
    expect(state.present).toBe(7)
    expect(canUndo(state)).toBe(false)
  })

  it("is a no-op to undo an empty or redo an exhausted history", () => {
    const state = createHistory("a")
    expect(undoHistory(state)).toBe(state)
    expect(redoHistory(state)).toBe(state)
  })

  it("walks a redo chain forward in order", () => {
    let state = createHistory("a")
    state = pushHistory(state, "b", 1000)
    state = pushHistory(state, "c", 2000)
    state = undoHistory(state)
    state = undoHistory(state)
    expect(state.present).toBe("a")
    state = redoHistory(state)
    expect(state.present).toBe("b")
    state = redoHistory(state)
    expect(state.present).toBe("c")
  })
})
