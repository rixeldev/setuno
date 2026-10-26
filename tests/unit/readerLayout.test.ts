import { describe, expect, it } from "vitest"

import { READER_COLUMN_MIN_WIDTH, readerColumnCount } from "@/libs/readerLayout"

describe("readerLayout", () => {
  it("stays single column when the body is too narrow for two", () => {
    expect(readerColumnCount(320)).toBe(1)
    expect(readerColumnCount(600)).toBe(1)
  })

  it("splits into two columns once there is room for both", () => {
    expect(readerColumnCount(660)).toBe(2)
    expect(readerColumnCount(1080)).toBe(2)
  })

  it("handles a tablet in landscape that would be cramped", () => {
    // 960 px window, sidebar 268, gutters 24 each -> ~644 px body.
    expect(readerColumnCount(644)).toBe(1)
  })

  it("rejects non-finite or negative widths", () => {
    expect(readerColumnCount(NaN)).toBe(1)
    expect(readerColumnCount(-10)).toBe(1)
  })

  it("exposes the minimum column width", () => {
    expect(READER_COLUMN_MIN_WIDTH).toBe(320)
  })
})