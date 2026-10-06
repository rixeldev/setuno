import { describe, expect, it } from "vitest"

import { setlistSummary } from "@/libs/performanceSetlists"

describe("setlist summary", () => {
  it("returns an empty label when nothing is attached", () => {
    expect(setlistSummary([])).toBe("")
  })

  it("shows a single name untouched", () => {
    expect(setlistSummary([{ id: "a", name: "Main set" }])).toBe("Main set")
  })

  it("joins up to `max` names", () => {
    const list = [
      { id: "a", name: "Main set" },
      { id: "b", name: "Encore" },
    ]
    expect(setlistSummary(list, 2)).toBe("Main set · Encore")
  })

  it("collapses the tail into +N", () => {
    const list = [
      { id: "a", name: "Main set" },
      { id: "b", name: "Encore" },
      { id: "c", name: "Soundcheck" },
    ]
    expect(setlistSummary(list)).toBe("Main set +2")
    expect(setlistSummary(list, 2)).toBe("Main set · Encore +1")
  })

  it("ignores blank names", () => {
    expect(setlistSummary([{ id: "a", name: "  " }])).toBe("")
  })
})
