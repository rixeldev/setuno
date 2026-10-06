import { describe, expect, it } from "vitest"

import {
  USERNAME_CHANGE_WINDOW_MS,
  canChangeUsername,
  normalizeUsername,
  usernameKey,
  usernameWithSuffix,
} from "@/libs/username"

describe("username helpers", () => {
  it("collapses whitespace for display and comparison", () => {
    expect(normalizeUsername("  Rixel   Ril ")).toBe("Rixel Ril")
    expect(usernameKey("Rixel")).toBe("rixel")
    expect(usernameKey(" RIXEL ")).toBe("rixel")
  })

  it("keeps names doc-id friendly", () => {
    expect(normalizeUsername("AC/DC")).toBe("AC-DC")
  })

  it("treats different cases as the same name", () => {
    expect(usernameKey("RiXeL-1415")).toBe(usernameKey("rixel-1415"))
  })

  it("appends a four digit suffix", () => {
    expect(usernameWithSuffix("Rixel", () => 0)).toBe("Rixel-1000")
    expect(usernameWithSuffix("Rixel", () => 0.999999)).toBe("Rixel-9999")
    expect(usernameWithSuffix("Rixel", () => 0.5)).toMatch(/^Rixel-\d{4}$/)
  })

  it("enforces the three month cooldown", () => {
    const day = 24 * 60 * 60 * 1000
    const now = Date.UTC(2026, 6, 1)
    expect(canChangeUsername(null, now)).toBe(true)
    expect(canChangeUsername(now - 89 * day, now)).toBe(false)
    expect(canChangeUsername(now - 90 * day, now)).toBe(true)
    expect(USERNAME_CHANGE_WINDOW_MS).toBe(90 * day)
  })
})
