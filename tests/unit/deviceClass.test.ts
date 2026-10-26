import { describe, expect, it } from "vitest"

import { isTabletViewport, TABLET_MIN_SHORT_SIDE } from "@/libs/deviceClass"

describe("deviceClass", () => {
  it("treats a 600 dp short side as a tablet", () => {
    expect(isTabletViewport(600, 960)).toBe(true)
    expect(isTabletViewport(960, 600)).toBe(true)
  })

  it("rejects phones", () => {
    expect(isTabletViewport(390, 844)).toBe(false)
    expect(isTabletViewport(430, 932)).toBe(false)
  })

  it("is rotation-independent", () => {
    expect(isTabletViewport(960, 600)).toBe(isTabletViewport(600, 960))
  })

  it("rejects non-finite values", () => {
    expect(isTabletViewport(NaN, 960)).toBe(false)
    expect(isTabletViewport(600, Infinity)).toBe(false)
  })

  it("exposes the threshold", () => {
    expect(TABLET_MIN_SHORT_SIDE).toBe(600)
  })
})