import { describe, expect, it } from "vitest"

import { setlistStep } from "@/libs/setlistNavigation"

const running = [{ songId: "a" }, { songId: "b" }, { songId: "c" }]

describe("setlist step", () => {
  it("walks the running order in both directions", () => {
    expect(setlistStep("b", running)).toEqual({ previousId: "a", nextId: "c" })
  })

  it("stops at both ends", () => {
    expect(setlistStep("a", running)).toEqual({ previousId: null, nextId: "b" })
    expect(setlistStep("c", running)).toEqual({ previousId: "b", nextId: null })
  })

  it("handles a single-song list", () => {
    expect(setlistStep("a", [{ songId: "a" }])).toEqual({ previousId: null, nextId: null })
  })

  it("returns null when the song is not in the list", () => {
    expect(setlistStep("z", running)).toBeNull()
    expect(setlistStep("z", [])).toBeNull()
  })
})
