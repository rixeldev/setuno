import { describe, expect, it } from "vitest"

import { tabAnimation, tabDirection } from "@/libs/tabNavigation"

describe("tab transitions", () => {
  it("slides in from the right when moving to a tab on the right", () => {
    expect(tabDirection(0, 2)).toBe("right")
    expect(tabDirection(1, 4)).toBe("right")
  })

  it("keeps the rightward slide when re-entering the same tab", () => {
    expect(tabDirection(2, 2)).toBe("right")
  })

  it("slides in from the left when moving back to a tab on the left", () => {
    expect(tabDirection(3, 1)).toBe("left")
    expect(tabDirection(4, 0)).toBe("left")
  })

  it("defaults to the rightward slide when the origin is not a tab", () => {
    expect(tabDirection(-1, 0)).toBe("right")
    expect(tabDirection(-1, 3)).toBe("right")
  })

  it("maps directions onto stack animations", () => {
    expect(tabAnimation("right")).toBe("slide_from_right")
    expect(tabAnimation("left")).toBe("slide_from_left")
  })
})
