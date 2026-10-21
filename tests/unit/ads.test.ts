import { describe, expect, it } from "vitest"

import { resolveBannerUnitId } from "@/libs/ads"

describe("resolveBannerUnitId", () => {
  it("keeps a real AdMob unit id", () => {
    const unitId = "ca-app-pub-1234567890123456/1234567890"
    expect(resolveBannerUnitId(unitId)).toBe(unitId)
  })

  it("keeps the SDK's official test units", () => {
    expect(resolveBannerUnitId("ca-app-pub-3940256099942544/6300978111")).toBe(
      "ca-app-pub-3940256099942544/6300978111",
    )
    expect(resolveBannerUnitId("ca-app-pub-3940256099942544/9214589741")).toBe(
      "ca-app-pub-3940256099942544/9214589741",
    )
  })

  it("trims the whitespace a pasted env var leaves behind", () => {
    expect(resolveBannerUnitId(" ca-app-pub-1234567890123456/1234567890\n")).toBe(
      "ca-app-pub-1234567890123456/1234567890",
    )
  })

  it("rejects the empty value the config generator leaves without ADMOB_BANNER_ID", () => {
    expect(resolveBannerUnitId("")).toBeNull()
    expect(resolveBannerUnitId("   ")).toBeNull()
    expect(resolveBannerUnitId(undefined)).toBeNull()
    expect(resolveBannerUnitId(null)).toBeNull()
  })

  it("rejects placeholders and truncated ids", () => {
    expect(resolveBannerUnitId("ca-app-pub-xxx/yyyy")).toBeNull()
    expect(resolveBannerUnitId("ca-app-pub-1234567890123456")).toBeNull()
    expect(resolveBannerUnitId("1234567890123456/1234567890")).toBeNull()
    expect(resolveBannerUnitId("ca-app-pub-123456789012345/1234567890")).toBeNull()
    expect(resolveBannerUnitId("ca-app-pub-1234567890123456/123456789")).toBeNull()
  })
})
