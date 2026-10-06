import { describe, expect, it } from "vitest"

import { isOffline } from "@/libs/connectivity"

describe("isOffline", () => {
  it("reports offline when the OS is sure", () => {
    expect(isOffline({ isConnected: false })).toBe(true)
    expect(isOffline({ isInternetReachable: false })).toBe(true)
    expect(isOffline({ isConnected: false, isInternetReachable: false })).toBe(true)
  })

  it("treats “still probing” (null) as online so nothing flashes", () => {
    expect(isOffline({ isConnected: null, isInternetReachable: null })).toBe(false)
    expect(isOffline({ isConnected: true, isInternetReachable: null })).toBe(false)
    expect(isOffline(null)).toBe(false)
    expect(isOffline(undefined)).toBe(false)
  })
})
