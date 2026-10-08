import { describe, expect, it } from "vitest"

import { compareVersions, maxVersion } from "@/libs/version"

describe("compareVersions", () => {
  it("orders numeric segments", () => {
    expect(compareVersions("1.0.1", "1.0.0")).toBe(1)
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1)
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1)
  })

  it("compares multi-digit segments numerically, not lexically", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1)
    expect(compareVersions("1.2.10", "1.2.9")).toBe(1)
  })

  it("treats missing segments as zero", () => {
    expect(compareVersions("1.1", "1.1.0")).toBe(0)
    expect(compareVersions("1.1", "1.0.9")).toBe(1)
  })

  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0)
  })

  it("treats malformed segments as zero instead of failing", () => {
    expect(compareVersions("abc", "0.0.0")).toBe(0)
    expect(compareVersions("1.beta.0", "1.0.0")).toBe(0)
    expect(compareVersions("1.0.0-rc1", "1.0.0")).toBe(0)
  })
})

describe("maxVersion", () => {
  it("returns the highest version", () => {
    expect(maxVersion(["1.0.0", "1.2.0", "1.1.9"])).toBe("1.2.0")
  })

  it("ignores empty entries", () => {
    expect(maxVersion(["", "  ", "1.0.0"])).toBe("1.0.0")
  })

  it("returns null when there is no value at all", () => {
    expect(maxVersion([])).toBeNull()
    expect(maxVersion(["", "   "])).toBeNull()
  })

  it("keeps the first value on ties", () => {
    expect(maxVersion(["1.0.0", "1.0.0"])).toBe("1.0.0")
  })
})
